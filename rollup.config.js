import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

export default [
  // {
  //   input: 'eko/src/index.ts',
  //   output: [
  //     {
  //       file: 'dist/index.esm.js',
  //       format: 'esm'
  //     }
  //   ],
  //   plugins: [
  //     resolve(),
  //     commonjs(),
  //     typescript({
  //       tsconfig: './tsconfig.json',
  //       declaration: true,
  //       declarationDir: 'dist',
  //       include: ['eko/src/**/*'],
  //       exclude: ['node_modules', 'dist', 'eko/src/extension/**/*']
  //     })
  //   ]
  // },
  // {
  //   input: 'eko/src/extension/index.ts',
  //   output: [
  //     {
  //       file: 'dist/extension.esm.js',
  //       format: 'esm'
  //     }
  //   ],
  //   plugins: [
  //     resolve(),
  //     commonjs(),
  //     typescript({ 
  //       tsconfig: './tsconfig.json',
  //       declaration: true,
  //       declarationDir: 'dist',
  //       include: ['eko/src/types/*', 'eko/src/extension/**/*', 'eko/src/universal_tools/**/*'],
  //       exclude: ['eko/src/extension/script']
  //     }),
  //     copy({
  //       targets: [
  //         { src: 'eko/src/extension/script', dest: 'dist/extension' }
  //       ]
  //     })
  //   ]
  // },
  // {
  //   input: 'eko/src/extension/content/index.ts',
  //   output: {
  //     file: 'dist/extension_content_script.js',
  //     format: 'esm'
  //   },
  //   plugins: [
  //     resolve(),
  //     commonjs(),
  //     typescript({ 
  //       tsconfig: './tsconfig.json',
  //       declaration: false,
  //       include: ['eko/src/extension/content/*'],
  //       declarationDir: 'dist'
  //     })
  //   ]
  // }
    {
      input: 'chrome-extension/background/index.ts',
      output: [
        {
          file: 'dist/background.js',
          format: 'esm'
        }
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          include: ['eko/src/**/*', 'chrome-extension/background/**/*'],
          exclude: ['node_modules', 'dist', 'eko/src/extension/script']
        })
      ]
    },
    {
      input: 'eko/src/extension/content/index.ts',
      output: [
        {
          file: 'dist/page_controller.js',
          format: 'esm'
        }
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          include: ['eko/src/extension/content/*']
        }),
        copy({
          targets: [
            { src: 'eko/src/extension/script/*', dest: 'dist/js' },
            { src: 'chrome-extension/public/*', dest: 'dist' }
          ]
        })
      ]
    },
    {
      input: 'chrome-extension/popup/index.ts',
      output: [
        {
          file: 'dist/popup.js',
          format: 'esm'
        }
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          jsx: 'react'
        })
      ]
    },
    {
      input: 'chrome-extension/options/index.ts',
      output: [
        {
          file: 'dist/options.js',
          format: 'esm'
        }
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          jsx: 'react'
        })
      ]
    },
];