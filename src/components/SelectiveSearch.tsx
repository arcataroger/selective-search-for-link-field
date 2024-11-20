import { Canvas } from 'datocms-react-ui';
import { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
type PropTypes = {
    ctx: RenderFieldExtensionCtx;
};
export const SelectiveSearch = ({ ctx }: PropTypes) => {

    return (
        <Canvas ctx={ctx}>
            <pre>{JSON.stringify(ctx, null, 2)}</pre>
        </Canvas>
    );
};