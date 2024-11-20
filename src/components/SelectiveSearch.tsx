import { Canvas, Form } from "datocms-react-ui";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { type PluginParams, SwitchFieldOptions } from "./FieldConfigScreen.tsx";
import { buildClient } from "@datocms/cma-client-browser";
import AsyncSelect from "react-select/async";
import {useEffect, useMemo, useState} from "react";
import type { MultiValue, SingleValue, StylesConfig} from "react-select";

type PropTypes = {
  ctx: RenderFieldExtensionCtx;
};

type SingleOrMultiSelectedRecords =
  | MultiValue<SwitchFieldOptions>
  | SingleValue<SwitchFieldOptions>;

const useStyles = (isDisabled?: boolean, error?: boolean) => {
  return useMemo<StylesConfig>(() => {
    return {
      placeholder: (provided) => ({
        ...provided,
        color: 'var(--placeholder-body-color)',
      }),
      container: (provided) => {
        return {
          ...provided,
          fontSize: 'inherit',
        };
      },

      control: (provided, { isFocused }) => {
        let result = provided;

        result = {
          ...result,
          minHeight: 40,
        };

        if (isFocused) {
          return {
            ...result,
            borderColor: error ? 'var(--alert-color)' : 'var(--accent-color)',
            backgroundColor: isDisabled ? 'var(--disabled-color)' : 'white',
            boxShadow: `0 0 0 3px ${
                error
                    ? 'rgba(var(--alert-color-rgb-components), 0.2)'
                    : 'var(--semi-transparent-accent-color)'
            }`,
            '&:hover': {
              borderColor: error ? 'var(--alert-color)' : 'var(--accent-color)',
            },
          };
        }

        return {
          ...result,
          borderColor: error ? 'var(--alert-color)' : 'var(--border-color)',
          backgroundColor: isDisabled ? 'var(--disabled-color)' : 'white',
          '&:hover': {
            borderColor: error
                ? 'var(--alert-color)'
                : 'var(--darker-border-color)',
          },
        };
      },
      multiValueRemove: (provided) => ({
        ...provided,
        cursor: 'pointer',
      }),
      menu: (provided) => {
        return {
          ...provided,
          zIndex: 1000,
          minWidth: 250,
        };
      },
      input: (provided) => {
        const result = {
          ...provided,
          boxShadow: 'none',
          'input:focus': {
            boxShadow: 'none',
          },
        };

        return result;
      },
      multiValue: (provided) => {
        return {
          ...provided,
          zIndex: 100,
          backgroundColor: 'var(--light-color)',
          userSelect: 'none',
        };
      },
      multiValueLabel: (provided) => ({
        ...provided,
        fontSize: 'inherit',
        padding: 3,
      }),
    };
  }, [isDisabled, error]);
};

export const SelectiveSearch = ({ ctx }: PropTypes) => {
  const {
    parameters,
    currentUserAccessToken,
    setFieldValue,
    fieldPath,
    field,
    formValues,
      itemTypes,
  } = ctx;
  const { formValuesByModelId, modelDataByModelId } =
    parameters as PluginParams;

  const isMultiLinkField = field.attributes.field_type === "links";
  const currentFieldData = formValues[fieldPath] as string | string[];

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

  const currentValue: SingleOrMultiSelectedRecords = Array.isArray(
    currentFieldData,
  )
    ? currentFieldData.map((record) => ({
        label: `Loading ${record}...`,
        value: record,
      }))
    : { label: `Loading ${currentFieldData}...`, value: currentFieldData };

  const [selectedRecords, setSelectedRecords] =
    useState<SingleOrMultiSelectedRecords>(currentValue);

  const cmaClient = buildClient({
    apiToken: currentUserAccessToken,
  });

  const searchRecords = async (input: string) => {
    const results = await Promise.all(
      Object.entries(formValuesByModelId).map(([modelId, formValues]) => {
        const { fields } = modelDataByModelId[modelId];

        const fieldFilters = formValues.map((formValue) => {
          const fieldId = formValue.value;
          const fieldDataFromPluginParams = fields.find(
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
      }),
    );

    const flattenedResults = results.flatMap((model) => model);
    console.log(flattenedResults);
    const convertedResults = flattenedResults.map((item) => ({
      value: item.id,
      label: `${item.name} (${modelDataByModelId[item.item_type.id].modelName})`,
    }));
    return convertedResults;
  };

  const handleChange = (formValue: SingleOrMultiSelectedRecords) => {
    setSelectedRecords(formValue);
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
        if (Array.isArray(currentFieldData)) {
          const records = await cmaClient.items.list({
            filter: {ids: currentFieldData.join()},
          });
          console.log('fetched records', records)
          const convertedRecords = records.map(item => {
            return {label: 'test', value: item.id}});
          setSelectedRecords(convertedRecords)
        }

        else {
          const record = await cmaClient.items.find(currentFieldData)
          const titleFieldId = itemTypes[record.item_type.id]?.relationships.title_field?.data?.id
          console.log(titleFieldId);
          const titleFieldApiKey = modelDataByModelId[record.item_type.id].fields.find(field => field.id === titleFieldId)?.attributes.api_key
          console.log(titleFieldApiKey)
          const actualRecordTitle = titleFieldApiKey && record[titleFieldApiKey] ? record[titleFieldApiKey] as string: 'Unknown';
          console.log(actualRecordTitle)
          const convertedRecord = {label: actualRecordTitle, value: record.id}
          console.log('fetched record', record)
          console.log('itemTypes', itemTypes)
          setSelectedRecords(convertedRecord)
        }
      })();
  }, [currentFieldData]);

  return (
    <Canvas ctx={ctx}>
      <Form>
        <AsyncSelect
          isMulti={isMultiLinkField}
          cacheOptions
          value={selectedRecords}
          onChange={handleChange}
          loadOptions={searchRecords}
          styles={useStyles()}
        />
        <pre>Form data:{JSON.stringify(currentFieldData, null, 2)}</pre>
        <pre>State: {JSON.stringify(selectedRecords, null, 2)}</pre>
      </Form>
    </Canvas>
  );
};
