import { Canvas, Form } from "datocms-react-ui";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { type PluginParams } from "./FieldConfigScreen.tsx";
import { useEffect, useState } from "react";
import { buildClient } from "@datocms/cma-client-browser";
import type * as SimpleSchemaTypes from "@datocms/cma-client/dist/types/generated/SimpleSchemaTypes";

type PropTypes = {
  ctx: RenderFieldExtensionCtx;
};

export const SelectiveSearch = ({ ctx }: PropTypes) => {
  const { parameters, currentUserAccessToken } = ctx;
  const { formValuesByModelId, modelDataByModelId } =
    parameters as PluginParams;

  const [searchResults, setSearchResults] = useState<
    SimpleSchemaTypes.ItemInstancesTargetSchema[]
  >([]);

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

  const cmaClient = buildClient({
    apiToken: currentUserAccessToken,
  });

  useEffect(() => {
    if (!formValuesByModelId || !Object.keys(formValuesByModelId).length) {
      return;
    }

    (async () => {
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
                  pattern: "chair",
                },
              },
            };
          });

          const generatedFilter =  {
            type: modelId,
                fields: { OR: fieldFilters },
          }

          console.log('filter', generatedFilter)

          return cmaClient.items.list({
              filter: generatedFilter,
          });
        }),
      );

      setSearchResults(results);
    })();
  }, [formValuesByModelId]);

  return (
    <Canvas ctx={ctx}>
      <Form>
        {/*<AsyncSelect isMulti cacheOptions loadOptions={se} />*/}
        <pre>{JSON.stringify(searchResults, null, 2)}</pre>
      </Form>
    </Canvas>
  );
};
