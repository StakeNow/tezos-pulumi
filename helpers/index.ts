import { readFileSync } from "fs"
import * as pulumi from "@pulumi/pulumi"
import * as YAML from "yaml"
import merge from "ts-deepmerge"

export const getEnvVar = (name: string): string => {
  const env = process.env[name]
  if (!env) {
    throw Error(`Environment variable "${name}" is not set`)
  }
  return env
}

export const parseYamlFile = (filePath: string) => {
  const yamlFile = readFileSync(filePath, "utf8")
  console.log("DFDSF", YAML.parse(yamlFile), typeof YAML.parse(yamlFile))
  return YAML.parse(yamlFile)
}

export const mergeWithArrayOverrideOption = (valuesList: Array<object>) =>
  merge.withOptions({ mergeArrays: false }, ...valuesList)

/**
 * Use to ignore properties when updating a resource.
 * - https://www.pulumi.com/docs/intro/concepts/resources/#ignorechanges
 */
export const ignoreChangesTransformation = (
  resource: pulumi.ResourceTransformationArgs,
  ignorePropertyNames: string[]
): pulumi.ResourceTransformationResult => ({
  props: resource.props,
  opts: pulumi.mergeOptions(resource.opts, {
    ignoreChanges: ignorePropertyNames,
  }),
})
