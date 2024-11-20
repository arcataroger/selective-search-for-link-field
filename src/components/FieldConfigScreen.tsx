import {RenderManualFieldExtensionConfigScreenCtx} from 'datocms-plugin-sdk';
import {Canvas, Form, SelectField, Spinner} from 'datocms-react-ui';
import type {SchemaTypes} from '@datocms/cma-client';
import type {MultiValue} from 'react-select';
import {useEffect, useState} from "react";

type PropTypes = {
    ctx: RenderManualFieldExtensionConfigScreenCtx;
};

// this is how we want to save our settings
type Parameters = {
    maxRating: number;
};

type ValidatorForLinkFields = {
    item_item_type: {
        item_types: string[]; // Replace `any` with the appropriate type for `item_types`
    };
};

type FieldsByModel = {
    id: string,
    name: string,
    api_key: string,
    searchableFields: SchemaTypes.Field[]
}[]

type SwitchFieldOptions = {
    label: string,
    value: string,
}

type SelectedFieldsByItemType = {
    [item_type: string]: MultiValue<SwitchFieldOptions>
}

// We can only use this sort of search on single and multi line string fields
const SEARCHABLE_FIELD_TYPES: SchemaTypes.FieldAttributes['field_type'][] = ['string', 'text']

export const FieldConfigScreen = ({ctx}: PropTypes) => {
    const {pendingField: {attributes: {validators}}} = ctx;
    const {item_item_type: {item_types: relatedModelIds}} = validators as ValidatorForLinkFields;

    const [fieldsByItemType, setFieldsByItemType] = useState<FieldsByModel | null>(null);
    const [selectedFieldsByItemType, setSelectedFieldsByItemType] = useState<SelectedFieldsByItemType>({});

    useEffect(() => {
        const fetchFields = async () => {
            const fieldsForAllItemTypes: FieldsByModel = await Promise.all(
                relatedModelIds.map(async (modelId) => {
                    const fieldsForThisItemType = await ctx.loadItemTypeFields(modelId)
                    const searchableFields = fieldsForThisItemType.filter(field => SEARCHABLE_FIELD_TYPES.includes(field.attributes.field_type))

                    return ({
                        id: modelId,
                        name: ctx.itemTypes[modelId]!.attributes.name,
                        api_key: ctx.itemTypes[modelId]!.attributes.api_key,
                        searchableFields
                    })
                }))
            setFieldsByItemType(fieldsForAllItemTypes);
        };

        fetchFields().catch((error) => {
            console.error('Failed to fetch fields:', error);
        });
    }, [relatedModelIds]);

    return (
        <Canvas ctx={ctx}>
            {fieldsByItemType
                ? <Form>
                    <h3>Which related fields should be searchable?</h3>
                    {fieldsByItemType.map(model => <div>
                        <h4 dangerouslySetInnerHTML={{__html: `For the "${model.name}" model (<code>${model.api_key}</code>)`}}/>
                        <SelectField
                            name={model.id}
                            id={model.id}
                            label={`Fields for ${model.name}`}
                            hint={'Only string and multi-line text fields can be searched by this plugin.'}
                            value={selectedFieldsByItemType[model.id]}
                            selectInputProps={{
                                isMulti: true,
                                options: model.searchableFields
                                    .sort((a, b) => a.attributes.position - b.attributes.position)
                                    .map(field => ({
                                        label: `${field.attributes.label} (${field.attributes.field_type})`,
                                        value: field.id
                                    })),
                            }}
                            onChange={(newValue) => setSelectedFieldsByItemType(prevState => ({
                                ...prevState,
                                [model.id]: newValue
                            }))}
                        />
                    </div>)}
                    <pre>{JSON.stringify(fieldsByItemType, null, 2)}</pre>
                </Form>
                : <>
                    <p>Loading fields, please wait...</p>
                    <Spinner size={24}/>
                </>
            }
        </Canvas>
    );
};