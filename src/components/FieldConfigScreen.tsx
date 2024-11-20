import { RenderManualFieldExtensionConfigScreenCtx } from "datocms-plugin-sdk";
import { Canvas, Form, SelectField, Spinner } from "datocms-react-ui";
import type { SchemaTypes } from "@datocms/cma-client";
import type { MultiValue } from "react-select";
import { useEffect, useState } from "react";

type PropTypes = {
  ctx: RenderManualFieldExtensionConfigScreenCtx;
};

// this is how we want to save our settings
export type PluginParams = {
  selectedFieldsAsFormOptionsByModelId: FormOptionsByModelId;
  relatedModelsById: ModelDataByModelId;
  pluginVersion: string;
};

type ValidatorForLinkFields = {
  item_item_type: {
    item_types: string[]; // Replace `any` with the appropriate type for `item_types`
  };
};

type ModelDataByModelId = {
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

export type SwitchFieldOptions = {
  label: string;
  value: string;
};

type FormOptionsByModelId = {
  [modelId: string]: MultiValue<SwitchFieldOptions>;
};

// We can only use this plugin on single and multi line string fields
// TODO add other supported field types
const SEARCHABLE_FIELD_TYPES: SchemaTypes.FieldAttributes["field_type"][] = [
  "string",
  "text",
];

export const basicOptionFormatter = ({
  itemId,
  itemLabel,
  modelLabel,
}: {
  itemId: string;
  itemLabel?: string;
  modelLabel?: string;
}): SwitchFieldOptions => {
  // Generate a label... this was clearer than a multi-level nested ternary
  const label: string = (() => {
    if (itemLabel && modelLabel) {
      return `${itemLabel} (${modelLabel} #${itemId})`;
    }

    if (itemLabel && !modelLabel) {
      return itemLabel;
    }

    if (modelLabel && !itemLabel) {
      return `Record ${itemId} (${modelLabel}`;
    }

    return `Record ${itemId}`;
  })();

  return {
    label: label,
    value: itemId,
  };
};

// @ts-ignore TODO fix advanced formatter
const advancedOptionLabelFormatter = ({
  isValid = true,
  isDraft = false,
  itemLabel,
  modelLabel,
  itemId,
}: {
  isValid?: boolean;
  isDraft?: boolean;
  itemLabel: string;
  modelLabel: string;
  itemId: string;
}) => {
  const hasStatus: boolean = isDraft || !isValid;

  return (
    <div className="BelongsToInput__option">
      {hasStatus && `(${!isValid && "Invalid "}${isDraft && "Draft"}) `}
      {itemLabel}
      {modelLabel && (
        <span className="BelongsToInput__item-id">
          {modelLabel} #{itemId}
        </span>
      )}
    </div>
  );
};

export const FieldConfigScreen = ({ ctx }: PropTypes) => {
  const {
    pendingField: {
      attributes: { validators },
    },
    itemTypes,
    setParameters,
    loadItemTypeFields,
  } = ctx;

  const { parameters } = ctx as unknown as { parameters: PluginParams };

  const {
    item_item_type: { item_types: relatedModelIds },
  } = validators as ValidatorForLinkFields;

  const [cachedModelDataByModel, setCachedModelDataByModel] =
    useState<ModelDataByModelId>({});

  const isModelDataLoaded = !!Object.keys(cachedModelDataByModel).length;

  const [selectedFormFieldsByModel, setSelectedFormFieldsByModel] =
    useState<FormOptionsByModelId>(
      parameters.selectedFieldsAsFormOptionsByModelId ?? {},
    );

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fieldsFromCtx: ModelDataByModelId = Object.fromEntries(
          await Promise.all(
            relatedModelIds.map(async (modelId) => {
              const fieldsForRelatedModel = await loadItemTypeFields(modelId);

              const searchableFieldIds = fieldsForRelatedModel
                .filter((field) =>
                  SEARCHABLE_FIELD_TYPES.includes(field.attributes.field_type),
                )
                .map((field) => field.id);

              const titleFieldId =
                itemTypes[modelId]?.relationships.title_field.data?.id;
              const titleFieldApiKey = fieldsForRelatedModel.find(
                (field) => field.id === titleFieldId,
              )?.attributes.api_key;
              const titleFieldLabel = fieldsForRelatedModel.find(
                (field) => field.id === titleFieldId,
              )?.attributes.label;

              const modelData: ModelDataByModelId[string] = {
                modelLabel: itemTypes[modelId]!.attributes.name,
                modelApiKey: itemTypes[modelId]!.attributes.api_key,
                titleFieldId,
                titleFieldApiKey,
                titleFieldLabel,
                relatedFieldData: fieldsForRelatedModel,
                searchableFieldIds,
                numberOfSearchableFields: searchableFieldIds?.length ?? 0,
              };

              return [modelId, modelData]; // This return shape looks a little weird only because of Object.fromEntries()
            }),
          ),
        );
        setCachedModelDataByModel(fieldsFromCtx);
      } catch (error) {
        console.error("Error fetching fields:", error);
      }
    };

    fetchFields();
  }, [relatedModelIds, itemTypes]);

  const handleChange = (
    newValue: MultiValue<SwitchFieldOptions>,
    modelId: string,
  ) => {
    setSelectedFormFieldsByModel((prevState) => ({
      ...prevState,
      [modelId]: newValue,
    }));

    const newParams: PluginParams = {
      selectedFieldsAsFormOptionsByModelId: {
        ...parameters.selectedFieldsAsFormOptionsByModelId,
        [modelId]: newValue,
      },
      relatedModelsById: {
        ...parameters.relatedModelsById,
        [modelId]: cachedModelDataByModel[modelId],
      },
      pluginVersion: "0.0.1",
    };

    setParameters(newParams);
  };

  return (
    <Canvas ctx={ctx}>
      {isModelDataLoaded ? (
        <Form style={{paddingBottom: '5em'}}>
          <h3>Which related fields should be searchable?</h3>
          {Object.entries(cachedModelDataByModel).map(([modelId, model]) => (
            <div id={modelId} key={modelId}>
              <h4
                dangerouslySetInnerHTML={{
                  __html: `For the "${model.modelLabel}" model (<code>${model.modelApiKey}</code>)`,
                }}
              />
              <SelectField
                name={modelId}
                id={modelId}
                label={`Fields for ${model.modelLabel}`}
                hint={
                  "Only string and multi-line text fields can be searched by this plugin."
                }
                value={selectedFormFieldsByModel[modelId]}
                selectInputProps={{
                  isMulti: true,
                  options: model.relatedFieldData
                    .sort(
                      (a, b) => a.attributes.position - b.attributes.position,
                    )
                    .map((field) =>
                      basicOptionFormatter({
                        itemId: field.id,
                        itemLabel: `${field.attributes.label} (${field.attributes.api_key})`,
                      }),
                    ),
                  // formatOptionLabel: optionLabelFormatter // TODO add advanced formatting
                }}
                onChange={(newValue) => handleChange(newValue, modelId)}
              />
            </div>
          ))}
        </Form>
      ) : (
        <>
          <p>Loading fields, please wait...</p>
          <Spinner size={24} />
        </>
      )}
    </Canvas>
  );
};
