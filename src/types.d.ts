import type {GroupBase, MultiValue, OptionsOrGroups, SingleValue} from "react-select";
import type {SchemaTypes} from "@datocms/cma-client";

/**
 * The parameters saved by the plugin.
 */
export type PluginParams = {
  /** The selected fields as form options, grouped by model ID. */
  selectedFieldsAsFormOptionsByModelId: FormOptionsByModelId;
  /** Data about related models, grouped by model ID. */
  relatedModelsById: ModelDataByModelId;
  /** The version of the plugin. */
  pluginVersion: string;
};
/**
 * Validator for link fields, specifying allowed item types.
 */
export type ValidatorForLinkFields = {
  item_item_type: {
    item_types: string[];
  };
};
/**
 * Mapping from model IDs to model data.
 */
export type ModelDataByModelId = {
  [modelId: string]: {
    modelLabel: string;
    modelApiKey: string;
    titleFieldId?: string;
    titleFieldApiKey?: string;
    titleFieldLabel?: string;
    relatedFieldData: SchemaTypes.Field[];
    searchableFieldIds: string[];
    numberOfSearchableFields: number;
  };
};
/**
 * Shape expected by react-select for their component
 */
export type SwitchFieldOptions = {
  label: string;
  value: string;
};
/**
 * Mapping from model IDs to selected form fields (as options).
 */
export type FormOptionsByModelId = {
  [modelId: string]: MultiValue<SwitchFieldOptions>;
};
/**
 * Represents the selected records, which can be single or multiple values.
 */
export type SingleOrMultiSelectedRecords =
  | MultiValue<SwitchFieldOptions>
  | SingleValue<SwitchFieldOptions>;
/**
 * Represents grouped options for react-select.
 */
export type GroupedOptions = OptionsOrGroups<
  SwitchFieldOptions,
  GroupBase<SwitchFieldOptions>
>;
