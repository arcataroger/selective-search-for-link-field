import {AsyncSelectField, Canvas, Form, Spinner} from "datocms-react-ui";
import {RenderFieldExtensionCtx} from "datocms-plugin-sdk";
import {buildClient, type SimpleSchemaTypes,} from "@datocms/cma-client-browser";
import {useEffect, useState} from "react";
import {debounce} from "../utils/debounce.ts";
import {GroupedOptions, PluginParams, SingleOrMultiSelectedRecords, SwitchFieldOptions,} from "../types";
import {basicOptionFormatter} from "../utils/basicOptionFormatter.ts";

/**
 * SelectiveSearch component for DatoCMS plugin.
 * Allows users to search and select linked records based on specified fields and models.
 *
 * @param props
 * @param props.ctx - Plugin context for a field extension (see https://www.datocms.com/docs/plugin-sdk/field-extensions#renderFieldExtension)
 * @returns JSX.Element
 */
export const SelectiveSearch = ({ ctx }: { ctx: RenderFieldExtensionCtx }) => {
  // Destructure necessary properties from the context.
  const {
    parameters, // Plugin parameters
    currentUserAccessToken, // User's access token for CMA
    setFieldValue, // Function to update field value
    fieldPath, // Path to the field in the form values
    field, // Field definition
    formValues, // Current form values
  } = ctx as RenderFieldExtensionCtx;

  // Extract specific parameters from the plugin configuration.
  const { selectedFieldsAsFormOptionsByModelId, relatedModelsById } =
    parameters as PluginParams;

  // Determine if the field is a multi-link field (allows multiple linked records).
  const isMultiLinkField = field.attributes.field_type === "links";

  // Get the current field value from form values.
  const currentFieldValue = formValues[fieldPath] as string;

  // If there is no current user access token, display an error message.
  if (!currentUserAccessToken) {
    return (
      <Canvas ctx={ctx}>
        <p>
          The Selective Search for Link Field plugin is missing your access
          token. It cannot perform searches without it.
        </p>
      </Canvas>
    );
  }

  // Initialize options based on the current field value.
  const initialOptions = (() => {
    // If there is no current value, return null.
    if (!currentFieldValue?.length) {
      return null;
    }

    // Split the current value (which can be comma-separated IDs).
    const split = currentFieldValue.split(",");

    // Map each ID to an option with a loading label.
    return split.map((itemId) =>
      basicOptionFormatter({ itemId, itemLabel: `Loading #${itemId}...` }),
    );
  })();

  // State to hold the currently selected options.
  const [selectedOptions, setSelectedOptions] =
    useState<SingleOrMultiSelectedRecords>(initialOptions);

  // Initialize the DatoCMS CMA client with the user's access token.
  const cmaClient = buildClient({
    apiToken: currentUserAccessToken,
  });

  /**
   * Converts a DatoCMS item to a react-select option.
   *
   * @param item - The DatoCMS item to convert.
   * @param showItemIdWithModelLabel - Whether to display item ID with the model label (default: false).
   * @param showModel - Whether to include the model label in the option (default: true).
   * @returns SwitchFieldOptions - The formatted option for react-select.
   */
  const itemToOption = (
    item: SimpleSchemaTypes.Item,
    showItemIdWithModelLabel = false,
    showModel = true,
  ): SwitchFieldOptions => {
    // Get the model information for the item.
    const modelInfo = relatedModelsById[item.item_type.id];
    const { titleFieldApiKey, modelLabel } = modelInfo;

    // Get the item label using the title field API key, if available.
    const itemLabel = titleFieldApiKey
      ? ((item[titleFieldApiKey] as string) ?? undefined)
      : undefined;

    // Format the option.
    return basicOptionFormatter({
      itemId: item.id,
      itemLabel,
      ...(showModel && { modelLabel }),
      showItemIdWithModelLabel: showItemIdWithModelLabel,
    });
  };

  /**
   * Performs the search for items based on the user input.
   *
   * @param input - The user's search input.
   * @returns Promise resolving to grouped options suitable for react-select.
   */
  const performSearch = async (input: string): Promise<GroupedOptions> => {
    if (input.trim() === "") {
      // If the input is empty, fetch the most recent records.
      const relatedModelIds = Object.keys(selectedFieldsAsFormOptionsByModelId);

      // Fetch the most recent records from these models.
      const mostRecentRecords = await cmaClient.items.list({
        filter: {
          type: relatedModelIds.join(","),
        },
        order_by: "_updatedAt_DESC",
        page: {
          limit: 10,
        },
      });

      // Group the options by model label.
      const optionsByModel: { [modelLabel: string]: SwitchFieldOptions[] } =
        mostRecentRecords.reduce(
          (acc, item) => {
            const { modelLabel } = relatedModelsById[item.item_type.id];
            if (!acc[modelLabel]) {
              acc[modelLabel] = [];
            }
            acc[modelLabel].push(itemToOption(item));
            return acc;
          },
          {} as { [modelLabel: string]: SwitchFieldOptions[] },
        );

      // Convert the grouped options to the format required by react-select.
      return Object.entries(optionsByModel).map(([label, options]) => ({
        label,
        options,
      }));
    }

    // If the input is not empty, perform a search across selected fields.
    const results = await Promise.all(
      Object.entries(selectedFieldsAsFormOptionsByModelId).map(
        async ([modelId, fieldsToSearchAsFormOptions]) => {
          const { relatedFieldData, modelLabel } = relatedModelsById[modelId];

          // For each field, create a query to search for the input.
          const queries: SimpleSchemaTypes.ItemInstancesHrefSchema[] =
            fieldsToSearchAsFormOptions.flatMap((fieldAsOption) => {
              const fieldId = fieldAsOption.value;
              const fieldDataFromPluginParams = relatedFieldData.find(
                (field) => field.id === fieldId,
              );

              if (!fieldDataFromPluginParams) return []; // Skip if field data is not found.

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

          // Execute all queries and flatten the results.
          const records = (
            await Promise.all(
              queries.map(async (query) => await cmaClient.items.list(query)),
            )
          ).flat();

          // Map the records to options.
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

  /**
   * Handles the change event from the select field.
   *
   * @param formValue - The new value from the select field.
   */
  const handleChange = (formValue: SingleOrMultiSelectedRecords) => {
    // Update the selected options state.
    setSelectedOptions(formValue);

    // Update the form value in DatoCMS.
    if (Array.isArray(formValue)) {
      // For multiple selections, map to an array of values.
      setFieldValue(
        fieldPath,
        formValue.map((option) => option.value),
      );
    } else {
      // For single selection, set the value directly.
      // @ts-expect-error: react-select's typings can be inconsistent.
      setFieldValue(fieldPath, formValue?.value);
    }
  };

  // Effect to fetch the full details of selected items when the current field value changes.
  useEffect(() => {
    (async () => {
      if (!currentFieldValue) {
        return;
      }
      if (Array.isArray(currentFieldValue)) {
        // If the field value is an array, fetch the items by IDs.
        const records = await cmaClient.items.list({
          filter: { ids: currentFieldValue.join() },
        });
        const formattedOptions = records.map((item) => itemToOption(item));
        setSelectedOptions(formattedOptions);
      } else {
        // If the field value is a single ID, fetch the item.
        const record = await cmaClient.items.find(currentFieldValue);
        setSelectedOptions(itemToOption(record, false));
      }
    })();
  }, [currentFieldValue]);

  // Generate a unique ID for the select field.
  const selectFieldId = `${fieldPath}-selective-search`;

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
            noOptionsMessage: ({ inputValue }) =>
              `No matches for "${inputValue}"`,
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
