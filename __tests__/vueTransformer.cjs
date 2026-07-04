const babelJest = require('babel-jest');
const vueJest = require('@vue/vue3-jest');

const babelTransformer = babelJest.createTransformer({
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: 'commonjs'
      }
    ],
    '@babel/preset-typescript'
  ]
});

function normalizeTransformResult(result) {
  if (typeof result === 'string') return { code: result };
  return result || { code: '' };
}

function vueRuntimeHelperPrelude(code) {
  // Some @vue/vue3-jest + Jest/Babel combinations emit a named render export
  // whose generated render function references Vue compiler helpers like
  // _openBlock, but the helper aliases are not in module scope after Jest's
  // CommonJS transform. Defining them as var aliases is safe here and fixes
  // ReferenceError: _openBlock is not defined without changing production code.
  const helperNames = [
    'openBlock',
    'createBlock',
    'createElementBlock',
    'createElementVNode',
    'createVNode',
    'createTextVNode',
    'createCommentVNode',
    'createStaticVNode',
    'resolveComponent',
    'resolveDynamicComponent',
    'withCtx',
    'withDirectives',
    'withKeys',
    'withModifiers',
    'renderSlot',
    'renderList',
    'Fragment',
    'Teleport',
    'Suspense',
    'KeepAlive',
    'Transition',
    'TransitionGroup',
    'toDisplayString',
    'normalizeClass',
    'normalizeStyle',
    'normalizeProps',
    'guardReactiveProps',
    'mergeProps',
    'createSlots',
    'unref',
    'isRef',
    'vModelText',
    'vModelCheckbox',
    'vModelRadio',
    'vModelSelect',
    'vModelDynamic',
    'vShow'
  ];

  const aliases = helperNames
    .filter((name) => code.includes(`_${name}`))
    .map((name) => `var _${name} = _vueRuntime.${name};`);

  if (!aliases.length) return '';

  return `\nvar _vueRuntime = require('vue');\n${aliases.join('\n')}\n`;
}

module.exports = {
  process(sourceText, sourcePath, transformOptions) {
    const vueResult = normalizeTransformResult(vueJest.process(sourceText, sourcePath, transformOptions));
    const babelResult = normalizeTransformResult(
      babelTransformer.process(vueResult.code, `${sourcePath}.js`, transformOptions)
    );

    const helperPrelude = vueRuntimeHelperPrelude(babelResult.code);

    // @vue/vue3-jest emits the render function as a named export for some SFCs.
    // Jest's CommonJS default import receives only the component object, so attach
    // the compiled render function to the default export before tests mount it.
    const attachRender = `
if (typeof exports !== 'undefined' && exports.default && exports.render && !exports.default.render) {
  exports.default.render = exports.render;
}
`;

    return {
      ...babelResult,
      code: `${helperPrelude}${babelResult.code}\n${attachRender}`
    };
  }
};
