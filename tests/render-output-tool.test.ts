import { describe, expect, it } from 'vitest';
import {
  applyEmitScreen,
  createRenderOutputState,
  validateEmitScreenArgs,
} from '../services/renderOutputTool.mjs';

describe('render output tool helpers', () => {
  it('validateEmitScreenArgs rejects empty html', () => {
    const result = validateEmitScreenArgs({ html: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected validation failure');
    }
    expect(result.error).toContain('replace requires');
  });

  it('applyEmitScreen emits incrementing revisions and tracks latest html', () => {
    const firstValidation = validateEmitScreenArgs({ html: '<div>first</div>', isFinal: false });
    const secondValidation = validateEmitScreenArgs({ html: '<div>second</div>', isFinal: true });
    if (!firstValidation.ok || !secondValidation.ok) {
      throw new Error('validation unexpectedly failed');
    }

    const first = applyEmitScreen(createRenderOutputState(), firstValidation.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_1',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error('expected emit_screen apply success');
    }
    expect(first.streamEvent.type).toBe('render_output');
    expect(first.streamEvent.revision).toBe(1);
    expect(first.nextState.latestHtml).toBe('<div>first</div>');

    const second = applyEmitScreen(first.nextState, secondValidation.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_2',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error('expected emit_screen apply success');
    }
    expect(second.streamEvent.revision).toBe(2);
    expect(second.streamEvent.isFinal).toBe(true);
    expect(second.nextState.latestHtml).toBe('<div>second</div>');
  });

  it('applies append_child patch against data-ui-id target', () => {
    const initial = validateEmitScreenArgs({
      html: '<section data-ui-id="root"><div data-ui-id="list"><p>One</p></div></section>',
    });
    if (!initial.ok) throw new Error('initial validation failed');
    const first = applyEmitScreen(createRenderOutputState(), initial.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_init',
    });
    if (!first.ok) throw new Error('initial apply failed');

    const patchArgs = validateEmitScreenArgs({
      op: 'append_child',
      baseRevision: first.nextState.renderCount,
      targetId: 'list',
      htmlFragment: '<p>Two</p>',
    });
    expect(patchArgs.ok).toBe(true);
    if (!patchArgs.ok) throw new Error('patch validation failed');

    const patched = applyEmitScreen(first.nextState, patchArgs.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_patch',
    });
    expect(patched.ok).toBe(true);
    if (!patched.ok) throw new Error('patch apply failed');
    expect(patched.streamEvent.revision).toBe(2);
    expect(patched.nextState.latestHtml).toContain('<p>One</p><p>Two</p>');
    expect(patched.streamEvent.op).toBe('append_child');
  });

  it('rejects patch when baseRevision is stale', () => {
    const initial = validateEmitScreenArgs({
      html: '<section data-ui-id="root"><div data-ui-id="title">A</div></section>',
    });
    if (!initial.ok) throw new Error('initial validation failed');
    const first = applyEmitScreen(createRenderOutputState(), initial.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_init',
    });
    if (!first.ok) throw new Error('initial apply failed');
    const secondReplaceArgs = validateEmitScreenArgs({
      html: '<section data-ui-id="root"><div data-ui-id="title">A2</div></section>',
    });
    if (!secondReplaceArgs.ok) throw new Error('second validation failed');
    const second = applyEmitScreen(first.nextState, secondReplaceArgs.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_second',
    });
    if (!second.ok) throw new Error('second apply failed');

    const patchArgs = validateEmitScreenArgs({
      op: 'set_text',
      baseRevision: first.nextState.renderCount,
      targetId: 'title',
      text: 'B',
    });
    if (!patchArgs.ok) throw new Error('patch validation unexpectedly failed');
    const patched = applyEmitScreen(second.nextState, patchArgs.value, {
      toolName: 'emit_screen',
      toolCallId: 'call_patch',
    });
    expect(patched.ok).toBe(false);
    if (patched.ok) throw new Error('expected revision mismatch');
    expect(patched.errorCode).toBe('REVISION_MISMATCH');
  });
});
