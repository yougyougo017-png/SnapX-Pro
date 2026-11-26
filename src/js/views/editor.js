import { SnapXEditor } from '../editor.js';

export async function renderEditor(ctx, root) {
  const capture = ctx.state.editorCapture
    || ctx.state.gallery[0]
    || ctx.state.samples[0]
    || null;
  const editor = new SnapXEditor(root, ctx, capture);
  ctx.onCleanup(() => editor.destroy());
  await editor.init();
}
