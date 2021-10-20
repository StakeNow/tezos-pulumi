import * as aws from "@pulumi/aws"
import * as k8s from "@pulumi/kubernetes"
import * as pulumi from "@pulumi/pulumi"

/**
 * Arguments for the ExternalDns component
 */
interface ExternalDnsArgs {
  /** The IAM role to attach the external-dns policy to */
  iamRole: aws.iam.Role
  /**
   * Values for the external-dns Helm chart
   * https://artifacthub.io/packages/helm/bitnami/external-dns#parameters.
   * Setting chart `values` here will override any other other chart values that
   * are configurable fields of ExternalDnsArgs. Such as `txtOwnerId`.
   */
  values?: pulumi.Inputs
  /** Helm chart version */
  version?: string
  /** A unique id that restricts the external-dns instance from syncing any
   * records that it is not an owner of in the hosted zone(s). You may use your
   * cluster id. If you have multiple clusters, each cluster should have its own
   * id. */
  txtOwnerId?: string
  /** List of hosted zone id's. Used for external-dns policy Action
   * "route53:ChangeResourceRecordSets", and as the "zoneIdFilters" value for
   * the external-dns Helm chart. Defualts to "hostedzone/*".
   */
  zoneIdFilters?: pulumi.Input<string>[]
  /** Namespace to deploy the chart in. Defaults to kube-system */
  namespace?: string

  // skipAwait?: boolean
}

/**
 * Deploy the external-dns Helm chart including the necessary IAM policy.
 * Helm chart: https://github.com/kubernetes-sigs/external-dns
 */
export default class ExteranlDns extends pulumi.ComponentResource {
  readonly args: ExternalDnsArgs

  constructor(args: ExternalDnsArgs, opts: pulumi.ComponentResourceOptions) {
    super("aws:external-dns:ExternalDns", "external-dns", {}, opts)
    this.args = args

    const hostedZoneResources: pulumi.Output<string>[] =
      args.zoneIdFilters?.map(
        (zoneId) => pulumi.interpolate`arn:aws:route53:::${zoneId}`
      ) || []
    if (!hostedZoneResources?.length) {
      hostedZoneResources.push(pulumi.output("hostedzone/*"))
    }

    const externalDnsPolicy = new aws.iam.Policy(
      "external-dns",
      {
        description:
          "Allows k8s external-dns to manage R53 Hosted Zone records.",
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["route53:ChangeResourceRecordSets"],
              Resource: hostedZoneResources,
            },
            {
              Effect: "Allow",
              Action: [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets",
              ],
              Resource: ["*"],
            },
          ],
        },
      },
      { parent: this }
    )

    new aws.iam.RolePolicyAttachment(
      "external-dns",
      {
        policyArn: externalDnsPolicy.arn,
        role: args.iamRole,
      },
      { parent: this }
    )

    new k8s.helm.v3.Chart(
      "external-dns",
      {
        chart: "external-dns",
        namespace: args.namespace || "kube-system",
        version: args.version || "5.4.10",
        fetchOpts: {
          repo: "https://charts.bitnami.com/bitnami",
        },
        values: {
          replicas: 2,
          txtOwnerId: args.txtOwnerId,
          // Delete route53 records after an ingress or its hosts are deleted.
          policy: "sync",
          // Limit possible target zones by zone id.
          zoneIdFilters: args.zoneIdFilters,
          aws: {
            zoneType: "public",
          },

          ...args.values,
        },
      },
      { parent: this }
    )

    this.registerOutputs()
  }
}