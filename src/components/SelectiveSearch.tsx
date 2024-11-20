import { AsyncSelectField, Canvas, Form, Spinner } from "datocms-react-ui";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import {
  basicOptionFormatter,
  type PluginParams,
  SwitchFieldOptions,
} from "./FieldConfigScreen.tsx";
import {
  buildClient,
  type SimpleSchemaTypes,
} from "@datocms/cma-client-browser";
import { useEffect, useState } from "react";
import type {
  GroupBase,
  MultiValue,
  OptionsOrGroups,
  SingleValue,
} from "react-select";
import { debounce } from "../utils/debounce.ts";

type PropTypes = {
  ctx: RenderFieldExtensionCtx;
};

type SingleOrMultiSelectedRecords =
  | MultiValue<SwitchFieldOptions>
  | SingleValue<SwitchFieldOptions>;

type GroupedOptions = OptionsOrGroups<
  SwitchFieldOptions,
  GroupBase<SwitchFieldOptions>
>;

export const SelectiveSearch = ({ ctx }: PropTypes) => {
  const {
    parameters,
    currentUserAccessToken,
    setFieldValue,
    fieldPath,
    field,
    formValues,
  } = ctx;
  const { selectedFieldsAsFormOptionsByModelId, relatedModelsById } =
    parameters as PluginParams;

  const isMultiLinkField = field.attributes.field_type === "links";
  const currentFieldValue = formValues[fieldPath] as string; // A single link is a record ID, multiple ones are comma-separated one

  if (!currentUserAccessToken) {
    return (
      <Canvas ctx={ctx}>
        <p>
          The Selective Search for Link Field plugin is missing your access
          token. It cannot do searches without it.
        </p>
      </Canvas>
    );
  }

  const initialOptions = (() => {
    if (!currentFieldValue?.length) {
      return null;
    }

    const split = currentFieldValue.split(",");

    return split.map((itemId) =>
      basicOptionFormatter({ itemId, itemLabel: `Loading #${itemId}...` }),
    );
  })();

  const [selectedOptions, setSelectedOptions] =
    useState<SingleOrMultiSelectedRecords>(initialOptions);

  const cmaClient = buildClient({
    apiToken: currentUserAccessToken,
  });

  const itemToOption = (item: SimpleSchemaTypes.Item, showItemIdWithModelLabel=false, showModel=true): SwitchFieldOptions => {
    const modelInfo = relatedModelsById[item.item_type.id];
    const { titleFieldApiKey, modelLabel } = modelInfo;

    const itemLabel = titleFieldApiKey
      ? ((item[titleFieldApiKey] as string) ?? undefined)
      : undefined;

    return basicOptionFormatter({
      itemId: item.id,
      itemLabel,
      ...(showModel && {modelLabel}),
      showItemIdWithModelLabel: showItemIdWithModelLabel,
    });
  };

  const performSearch = async (input: string): Promise<GroupedOptions> => {
    if (input.trim() === "") {
      const relatedModelIds = Object.keys(selectedFieldsAsFormOptionsByModelId);
      const mostRecentRecords = await cmaClient.items.list({
        filter: {
          type: relatedModelIds.join(","),
        },
        order_by: "_updatedAt_DESC",
        page: {
          limit: 10,
        },
      });

      console.log("mostRecentRecords", mostRecentRecords);

      let optionsByModel: { [modelLabel: string]: SwitchFieldOptions[] } = {};

      for (const item of mostRecentRecords) {
        const { modelLabel } = relatedModelsById[item.item_type.id];
        // Ensure optionsByModel[modelLabel] is initialized
        if (!optionsByModel[modelLabel]) {
          optionsByModel[modelLabel] = [];
        }
        optionsByModel[modelLabel].push(itemToOption(item));
      }

      console.log("optionsByModel", optionsByModel);

      return Object.entries(optionsByModel).map(([label, options]) => ({
        label,
        options,
      }));
    }

    const results = await Promise.all(
      Object.entries(selectedFieldsAsFormOptionsByModelId).map(
        async ([modelId, fieldsToSearchAsFormOptions]) => {
          const { relatedFieldData, modelLabel } = relatedModelsById[modelId];

          // TODO once the boolean OR bug is fixed, replace these separate queries with one per model
          const queries: SimpleSchemaTypes.ItemInstancesHrefSchema[] = fieldsToSearchAsFormOptions.flatMap((fieldAsOption) => {
            const fieldId = fieldAsOption.value;
            const fieldDataFromPluginParams = relatedFieldData.find(
                (field) => field.id === fieldId
            );

            if (!fieldDataFromPluginParams) return []; // Return an empty array to exclude this field.

            const {
              attributes: { api_key },
            } = fieldDataFromPluginParams;

            return {
              filter: {
                type: modelId,
                fields: {
                  [api_key]: {
                    matches: {
                      pattern: input.trim(),
                    },
                  },
                },
              },
            };
          });


          const records = (
              await Promise.all(
                  queries.map(async (query) => await cmaClient.items.list(query))
              )
          ).flat();

          const options = records.map((item) => itemToOption(item));

          return {
            label: modelLabel,
            options,
          };
        },
      ),
    );

    return results;
  };

  const handleChange = (formValue: SingleOrMultiSelectedRecords) => {
    setSelectedOptions(formValue);
    if (Array.isArray(formValue)) {
      setFieldValue(
        fieldPath,
        formValue.map((formValue) => formValue.value),
      );
    } else {
      // @ts-expect-error react-select's typings are weird. It can return either an array or a string or nothing, but the types don't match this behavior
      setFieldValue(fieldPath, formValue?.value);
    }
  };

  useEffect(() => {
    (async () => {
      if (!currentFieldValue) {
        return;
      }
      if (Array.isArray(currentFieldValue)) {
        const records = await cmaClient.items.list({
          filter: { ids: currentFieldValue.join() },
        });
        const formattedOptions = records.map((item) => itemToOption(item));
        setSelectedOptions(formattedOptions);
      } else {
        const record = await cmaClient.items.find(currentFieldValue);
        setSelectedOptions(itemToOption(record, false));
      }
    })();
  }, [currentFieldValue]);

  const selectFieldId = `${fieldPath}-selective-search}`;

  return (
    <Canvas ctx={ctx}>
      <Form>
        <AsyncSelectField
          id={selectFieldId}
          name={selectFieldId}
          label={null}
          selectInputProps={{
            isMulti: isMultiLinkField,
            cacheOptions: true,
            loadOptions: debounce(performSearch),
            isClearable: true,
            defaultOptions: true,
            loadingMessage: () => (
              <span>
                <Spinner /> Searching...
              </span>
            ),
            noOptionsMessage: ({inputValue}) => `No matches for "${inputValue}"`,
          }}
          value={selectedOptions}
          onChange={(newValue) =>
            handleChange(newValue as SingleOrMultiSelectedRecords)
          }
        />
      </Form>
    </Canvas>
  );
};
