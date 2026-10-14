const palette = require('tailwindcss/colors');

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const NEUTRALS = ['gray', 'slate', 'neutral'];
const HUES = ['red', 'orange', 'amber', 'yellow', 'green', 'blue', 'purple'];

const NEUTRAL_DARK = {
  bg: { white: '22 27 34', 50: '13 17 23', 100: '28 33 41', 200: '38 44 54', 300: '48 54 61', 400: '72 79 88' },
  text: {
    black: '230 237 243', 50: '38 44 54', 100: '48 54 61', 200: '61 68 77', 300: '84 93 104', 400: '110 118 129',
    500: '139 148 158', 600: '159 166 177', 700: '183 189 200', 800: '209 215 224', 900: '230 237 243', 950: '240 246 252',
  },
  border: { white: '48 54 61', 50: '33 38 45', 100: '33 38 45', 200: '48 54 61', 300: '61 68 77', 400: '84 93 104', 500: '110 118 129' },
};

const INVERTED_SHADES = {
  bg: ['50', '100', '200', '300', '400'],
  text: ['600', '700', '800', '900', '950'],
  border: SHADES,
};

function rgb(hex) {
  const digits = hex.slice(1);
  const value = parseInt(digits.length === 3 ? digits.replace(/./g, '$&$&') : digits, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function mirror(shade) {
  return shade === '50' ? '950' : shade === '950' ? '50' : String(1000 - Number(shade));
}

function variable(group, color, shade) {
  return shade ? `--c-${group}-${color}-${shade}` : `--c-${group}-${color}`;
}

function build() {
  const light = {};
  const dark = {};
  const theme = { bg: {}, text: {}, border: {} };

  for (const group of Object.keys(theme)) {
    const special = group === 'text' ? 'black' : 'white';
    light[variable(group, special)] = rgb(palette[special]);
    dark[variable(group, special)] = NEUTRAL_DARK[group][special];
    theme[group][special] = `rgb(var(${variable(group, special)}) / <alpha-value>)`;

    for (const color of [...NEUTRALS, ...HUES]) {
      theme[group][color] = {};
      for (const shade of SHADES) {
        const name = variable(group, color, shade);
        light[name] = rgb(palette[color][shade]);
        const darkValue = NEUTRALS.includes(color)
          ? NEUTRAL_DARK[group][shade]
          : INVERTED_SHADES[group].includes(shade) && rgb(palette[color][mirror(shade)]);
        if (darkValue) dark[name] = darkValue;
        theme[group][color][shade] = `rgb(var(${name}) / <alpha-value>)`;
      }
    }
  }
  return { light, dark, theme };
}

const { light, dark, theme } = build();

module.exports = {
  themeColors: {
    backgroundColor: theme.bg,
    gradientColorStops: theme.bg,
    textColor: theme.text,
    placeholderColor: theme.text,
    fill: theme.text,
    stroke: theme.text,
    borderColor: theme.border,
    divideColor: theme.border,
    ringColor: theme.border,
    outlineColor: theme.border,
  },
  colorVariables: {
    ':root': { ...light, colorScheme: 'light dark' },
    '@media (prefers-color-scheme: dark)': { ':root': dark },
  },
};
