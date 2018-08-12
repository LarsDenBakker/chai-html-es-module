import commonjs from 'rollup-plugin-commonjs';

export default [
  {
    input: './node_modules/chai-html/lib/chai-html.js',
    output: {
      file: './chai-html.js',
      format: 'es',
    },
    plugins: [
      commonjs(),
    ],
  },
];