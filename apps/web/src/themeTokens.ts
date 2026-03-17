export const themeTokenGroups = {
  bg: ['page', 'shell', 'card', 'cardSubtle', 'cardElevated'],
  text: ['primary', 'secondary', 'muted', 'inverse'],
  border: ['subtle', 'default', 'strong', 'focus'],
  action: ['primary.bg', 'primary.text', 'primary.bgHover', 'secondary.bg', 'secondary.text', 'secondary.bgHover'],
  feedback: ['high.bg', 'high.text', 'medium.bg', 'medium.text', 'low.bg', 'low.text'],
  state: ['poor.hero', 'weak.hero', 'usable.hero', 'strong.hero', 'excellent.hero'],
  surface: [
    'default.bg',
    'default.border',
    'suggestion.bg',
    'suggestion.border',
    'rewrite.bg',
    'rewrite.border',
    'verdict.bg',
    'verdict.border',
  ],
} as const;
