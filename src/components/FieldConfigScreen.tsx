import {RenderManualFieldExtensionConfigScreenCtx} from "datocms-plugin-sdk";
import {Canvas, Form, SelectField, Spinner} from "datocms-react-ui";
import type {SchemaTypes} from "@datocms/cma-client";
import type {MultiValue} from "react-select";
import {useEffect, useState} from "react";
import type {
    FormOptionsByModelId,
    ModelDataByModelId,
    PluginParams,
    SwitchFieldOptions,
    ValidatorForLinkFields,
} from "../types";
import {basicOptionFormatter} from "../utils/basicOptionFormatter.ts";

/**
 * Configuration screen for the field extension.
 *
 * @param props - The props for the component.
 * @param props.ctx - Plugin context for a field extension config screen (see https://www.datocms.com/docs/plugin-sdk/manual-field-extensions#add-per-field-config-screens-to-manual-field-extensions)
 */
export const FieldConfigScreen = ({
  ctx,
}: {
  ctx: RenderManualFieldExtensionConfigScreenCtx;
}) => {
  // Extract necessary properties from the context.
  const {
    pendingField: {
      attributes: { validators },
    },
    itemTypes,
    setParameters,
    loadItemTypeFields,
  } = ctx;

  // We can only use this plugin on single and multi-line string fields.
  // TODO: Add other supported field types.
  const SEARCHABLE_FIELD_TYPES: SchemaTypes.FieldAttributes["field_type"][] = [
    "string",
    "text",
  ];

  // Extract plugin parameters from context.
  const { parameters } = ctx as unknown as { parameters: PluginParams };

  // Get the list of related model IDs from the field validators.
  const {
    item_item_type: { item_types: relatedModelIds },
  } = validators as ValidatorForLinkFields;

  // State to store data about related models.
  const [modelDataByModelId, setModelDataByModelId] =
    useState<ModelDataByModelId>({});

  // Flag to indicate whether model data has been loaded.
  const isModelDataLoaded = !!Object.keys(modelDataByModelId).length;

  // State to store the selected form fields for each model.
  const [selectedFormFieldsByModel, setSelectedFormFieldsByModel] =
    useState<FormOptionsByModelId>(
      parameters?.selectedFieldsAsFormOptionsByModelId ?? {},
    );

  // Fetch fields for each related model when relatedModelIds or itemTypes change.
  useEffect(() => {
    const fetchFields = async () => {
      try {
        // Fetch fields for each related model ID.
        const fieldsFromCtx: ModelDataByModelId = Object.fromEntries(
          await Promise.all(
            relatedModelIds.map(async (modelId) => {
              const fieldsForRelatedModel = await loadItemTypeFields(modelId);

              // Get IDs of fields that are searchable.
              const searchableFieldIds = fieldsForRelatedModel
                .filter((field) =>
                  SEARCHABLE_FIELD_TYPES.includes(field.attributes.field_type),
                )
                .map((field) => field.id);

              const titleFieldId =
                itemTypes[modelId]?.relationships.title_field.data?.id;
              const titleField = fieldsForRelatedModel.find(
                (field) => field.id === titleFieldId,
              );
              const titleFieldApiKey = titleField?.attributes.api_key;
              const titleFieldLabel = titleField?.attributes.label;

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

              // Return an entry for Object.fromEntries()
              return [modelId, modelData];
            }),
          ),
        );
        setModelDataByModelId(fieldsFromCtx);
      } catch (error) {
        console.error("Error fetching fields:", error);
      }
    };

    fetchFields();
  }, [relatedModelIds, itemTypes, loadItemTypeFields]);

  // Handle changes to the selected form fields.
  const handleChange = (
    newValue: MultiValue<SwitchFieldOptions>,
    modelId: string,
  ) => {
    // Update state with new selected fields.
    setSelectedFormFieldsByModel((prevState) => ({
      ...prevState,
      [modelId]: newValue,
    }));

    // Update plugin parameters.
    const newParams: PluginParams = {
      selectedFieldsAsFormOptionsByModelId: {
        ...parameters.selectedFieldsAsFormOptionsByModelId,
        [modelId]: newValue,
      },
      relatedModelsById: {
        ...parameters.relatedModelsById,
        [modelId]: modelDataByModelId[modelId],
      },
      pluginVersion: "0.0.1",
    };

    setParameters(newParams);
  };

  return (
    <Canvas ctx={ctx}>
      {isModelDataLoaded ? (
        <Form style={{ paddingBottom: "5em" }}>
          <h3>Which related fields should be searchable?</h3>
          {Object.entries(modelDataByModelId).map(([modelId, model]) => (
            <div id={modelId} key={modelId}>
              <h4>
                For the &quot;{model.modelLabel}&quot; model (
                <code>{model.modelApiKey}</code>)
              </h4>
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
                    .filter((field) =>
                      SEARCHABLE_FIELD_TYPES.includes(
                        field.attributes.field_type,
                      ),
                    )
                    .sort(
                      (a, b) => a.attributes.position - b.attributes.position,
                    )
                    .map((field) =>
                      basicOptionFormatter({
                        itemId: field.id,
                        itemLabel: `${field.attributes.label} (${field.attributes.api_key})`,
                      }),
                    ),
                  // formatOptionLabel: advancedOptionLabelFormatter, // TODO: add advanced formatting
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
