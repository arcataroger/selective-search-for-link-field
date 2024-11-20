import {connect} from 'datocms-plugin-sdk';
import {render} from "./utils/render.tsx";
import {FieldConfigScreen} from "./components/FieldConfigScreen.tsx";
import {SelectiveSearch} from "./components/SelectiveSearch.tsx";
import 'datocms-react-ui/styles.css';

const id = 'selectiveSearchForLinkField'

connect({
    manualFieldExtensions() {
        return [
            {
                id: id,
                name: 'Selective Search for Link Field',
                type: 'editor',
                fieldTypes: ['link', 'links'],
                configurable: true,
            },
        ];
    },
    renderManualFieldExtensionConfigScreen(_, ctx) {
        render(<FieldConfigScreen ctx={ctx}/>)
    },
    renderFieldExtension(fieldId, ctx) {
        if (fieldId === id) {
            render(<SelectiveSearch ctx={ctx}/>)
        }
    }
});