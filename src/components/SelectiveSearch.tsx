import {AsyncSelectField, Canvas, Form, Spinner} from "datocms-react-ui";
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
import type { MultiValue, SingleValue } from "react-select";
import {debounce} from "../utils/debounce.ts";

type PropTypes = {
  ctx: RenderFieldExtensionCtx;
};

type SingleOrMultiSelectedRecords =
  | MultiValue<SwitchFieldOptions>
  | SingleValue<SwitchFieldOptions>;

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
  const savedValue = formValues[fieldPath] as string; // A single link is a record ID, multiple ones are comma-separated one

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
    if (!savedValue?.length) {
      return null
    }

    const split = savedValue.split(',')

    return split.map(itemId => basicOptionFormatter({itemId, itemLabel: `Loading #${itemId}...`}))
  })()

  const [selectedOptions, setSelectedOptions] =
    useState<SingleOrMultiSelectedRecords>(initialOptions);

  const cmaClient = buildClient({
    apiToken: currentUserAccessToken,
  });

  const itemToOption = (item: SimpleSchemaTypes.Item): SwitchFieldOptions => {
    const modelInfo = relatedModelsById[item.item_type.id];
    const { titleFieldApiKey, modelLabel } = modelInfo;

    const itemLabel = titleFieldApiKey
      ? ((item[titleFieldApiKey] as string) ?? undefined)
      : undefined;

    return basicOptionFormatter({
      itemId: item.id,
      itemLabel,
      modelLabel,
    });
  };

  const searchRecords = async (
    input: string,
  ): Promise<MultiValue<SwitchFieldOptions>> => {
    if (input.trim() === "") {
      const relatedModelIds = Object.keys(
        selectedFieldsAsFormOptionsByModelId,
      );
      const mostRecentRecords = await cmaClient.items.list({
        filter: {
          type: relatedModelIds.join(","),
        },
        order_by: "_updatedAt_DESC",
      });

      return mostRecentRecords.map((item) => itemToOption(item));
    }

    const results = await Promise.all(
      Object.entries(selectedFieldsAsFormOptionsByModelId).map(
        ([modelId, formValues]) => {
          const { relatedFieldData } = relatedModelsById[modelId];

          const fieldFilters = formValues.map((formValue) => {
            const fieldId = formValue.value;
            const fieldDataFromPluginParams = relatedFieldData.find(
              (field) => field.id === fieldId,
            );
            if (!fieldDataFromPluginParams) return [];
            const {
              attributes: { api_key },
            } = fieldDataFromPluginParams;
            return {
              [api_key]: {
                matches: {
                  pattern: input,
                },
              },
            };
          });

          const generatedFilter = {
            type: modelId,
            fields: { OR: fieldFilters[0] }, // TODO make the OR filter work
          };

          return cmaClient.items.list({
            filter: generatedFilter,
          });
        },
      ),
    );

    const flattenedResults = results.flatMap((model) => model);
    console.log(flattenedResults);
    const formattedResults = flattenedResults.map((item) => itemToOption(item));
    return formattedResults;
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
      if (Array.isArray(savedValue)) {
        const records = await cmaClient.items.list({
          filter: { ids: savedValue.join() },
        });
        const formattedOptions = records.map((item) => itemToOption(item));
        setSelectedOptions(formattedOptions);
      } else {
        const record = await cmaClient.items.find(savedValue);
        setSelectedOptions(itemToOption(record));
      }
    })();
  }, [savedValue]);


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
            loadOptions: debounce(searchRecords),
            isClearable: true,
            defaultOptions: true,
            loadingMessage: () => <span><Spinner/> Searching...</span>,
            noOptionsMessage: () => 'No matching records found.',
          }}
          value={selectedOptions}
          onChange={(newValue) =>
            handleChange(newValue as SingleOrMultiSelectedRecords)
          }
        />
        <pre>Form data: {JSON.stringify(savedValue, null, 2)}</pre>
        <pre>State: {JSON.stringify(selectedOptions, null, 2)}</pre>
        <pre>Params: {JSON.stringify(parameters, null, 2)}</pre>
      </Form>
    </Canvas>
  );
};
