import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import css from 'rollup-plugin-css-only';
import babel from 'rollup-plugin-babel';

const plugins = [
  css({
    output: './dist/style.css'
  }),
  resolve(),
  commonjs(),
  babel({
    exclude: 'node_modules/**'
  })
];

export default {
  entry: 'src/main.js',
  format: 'iife',
  plugins,
  dest: 'dist/bundle.js',
  moduleName: 'caravane'
};
