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
  formValuesByModelId: FormValuesByModelId;
  modelDataByModelId: ModelDataByModelId;
};

type ValidatorForLinkFields = {
  item_item_type: {
    item_types: string[]; // Replace `any` with the appropriate type for `item_types`
  };
};

type ModelDataByModelId = {
  [modelId: string]: {
    modelName: string;
    modelApiKey: string;
    fields: SchemaTypes.Field[];
    searchableFieldIds: string[];
  };
};

type SwitchFieldOptions = {
  label: string;
  value: string;
};

type FormValuesByModelId = {
  [modelId: string]: MultiValue<SwitchFieldOptions>;
};

// We can only use this sort of search on single and multi line string fields
const SEARCHABLE_FIELD_TYPES: SchemaTypes.FieldAttributes["field_type"][] = [
  "string",
  "text",
];

export const FieldConfigScreen = ({ ctx }: PropTypes) => {
  const {
    pendingField: {
      attributes: { validators },
    },
    itemTypes,
  } = ctx;

  const { parameters } = ctx as unknown as { parameters: PluginParams };

  const {
    item_item_type: { item_types: relatedModelIds },
  } = validators as ValidatorForLinkFields;

  const [cachedModelDataByModel, setCachedModelDataByModel] =
    useState<ModelDataByModelId>({});

  const [selectedFormFieldsByModel, setSelectedFormFieldsByModel] =
    useState<FormValuesByModelId>(parameters.formValuesByModelId ?? {});

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fieldsFromCtx = Object.fromEntries(
          await Promise.all(
            relatedModelIds.map(async (modelId) => {
              const fieldsForThisItemType =
                await ctx.loadItemTypeFields(modelId);

              const searchableFieldIds = fieldsForThisItemType
                .filter((field) =>
                  SEARCHABLE_FIELD_TYPES.includes(field.attributes.field_type),
                )
                .map((field) => field.id);

              return [
                modelId,
                {
                  modelName: itemTypes[modelId]?.attributes.name,
                  modelApiKey: itemTypes[modelId]?.attributes.api_key,
                  fields: fieldsForThisItemType,
                  searchableFieldIds,
                },
              ];
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

    const newParams:PluginParams = {
      ...parameters,
      formValuesByModelId: {
        ...parameters.formValuesByModelId,
        [modelId]: newValue,
      },
      modelDataByModelId: {
        ...parameters.modelDataByModelId,
        [modelId]: cachedModelDataByModel[modelId],
      },
    }

    ctx.setParameters(newParams);
  };

  return (
    <Canvas ctx={ctx}>
      {!!Object.keys(cachedModelDataByModel).length ? (
        <Form>
          <h3>Which related fields should be searchable?</h3>
          {Object.entries(cachedModelDataByModel).map(([modelId, model]) => (
            <div id={modelId} key={modelId}>
              <h4
                dangerouslySetInnerHTML={{
                  __html: `For the "${model.modelName}" model (<code>${model.modelApiKey}</code>)`,
                }}
              />
              <SelectField
                name={modelId}
                id={modelId}
                label={`Fields for ${model.modelName}`}
                hint={
                  "Only string and multi-line text fields can be searched by this plugin."
                }
                value={selectedFormFieldsByModel[modelId]}
                selectInputProps={{
                  isMulti: true,
                  options: model.fields
                    .sort(
                      (a, b) => a.attributes.position - b.attributes.position,
                    )
                    .map((field) => ({
                      label: `${field.attributes.label} (${field.attributes.field_type})`,
                      value: field.id,
                    })),
                }}
                onChange={(newValue) => handleChange(newValue, modelId)}
              />
            </div>
          ))}
          <pre>{JSON.stringify(ctx.parameters, null, 2)}</pre>
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
