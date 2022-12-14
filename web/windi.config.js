export default {
  shortcuts: {
    center: 'flex justify-center items-center',
  },
  theme: {
    colors: {
      'primary': '#0c8ce9',
      'transparent': 'transparent',
      'primary-disable': '#DD96FF',
      'primary-light': '#D170FF',
      'primary-dark': '#D170FF',
      'secondary': '#EBEBF0',
      'secondary-dark': '#575a62',
      'light': '#ffffff',
      'light-300': '#d1d1d1',
      'yellow': '#fcd34d',
      'yellow-500': '#f9c830',
      'yellow-600': '#d78215',
      'green': '#29d23b',
      'black': '#000',
      'red': '#bf3939',
      'red-light': '#bf3989',
    },
    borderColor: (theme) => ({
      ...theme('colors'),
      'secondary': '#F2F1F6',
    }),
    textColor: (theme) => ({
      ...theme('colors'),
      'secondary': '#b8b8b8',
      'primary-green': '#178736',
    }),
    placeholderColor: (theme) => ({
      ...theme('textColor'),
      secondary: '#828793',
    }),
    backgroundColor: (theme) => ({
      ...theme('colors'),
      'default': '#fff',
      'secondary': 'rgb(213,215,219)',
      'secondary-dark': '#424242',
      'primary': {
        100: '#fcfcff',
        200: '#fafaff',
        500: '#0c8ce9',
      },
      'light': {
        100: '#f9f9f9',
        300: '#fdfdfd',
        400: '#fafafa',
        200: '#F9FBFC',
        500: 'rgb(240, 240, 240)',
      },
    }),
    boxShadow: (theme) => ({
      'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
      'outline': `inset 0px 0px 0px 1px ${theme('colors').primary}`,
      'outline-error': `inset 0px 0px 0px 1px ${theme('colors').red}`,
      'none': 'none',
    }),
  },
};
