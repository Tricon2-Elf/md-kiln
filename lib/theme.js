const DEFAULTS = {
  type: 'gradient',
  color: '#35b2f5',
  gradientStart: '#35b2f5',
  gradientEnd: '#ffffff',
  image: '',
  repeat: 'no-repeat',
  position: 'center center',
  size: 'cover',
};

function normalizeImagePath(image) {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return image;
  return `/${image}`;
}

function getThemeVars(theme = {}) {
  const bg = { ...DEFAULTS, ...theme.background };
  const type = bg.type || 'gradient';

  const vars = {
    backgroundColor: bg.color,
    backgroundImage: 'none',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    backgroundSize: 'auto',
  };

  if (type === 'solid') {
    vars.backgroundColor = bg.color;
    vars.backgroundImage = 'none';
    return vars;
  }

  if (type === 'image') {
    const image = normalizeImagePath(bg.image);
    if (image) {
      vars.backgroundColor = bg.color;
      vars.backgroundImage = `url("${image}")`;
      vars.backgroundRepeat = bg.repeat;
      vars.backgroundPosition = bg.position;
      vars.backgroundSize = bg.size;
      return vars;
    }
  }

  const start = bg.gradientStart || bg.color;
  const end = bg.gradientEnd;
  vars.backgroundColor = start;
  vars.backgroundImage = `linear-gradient(to bottom, ${start}, ${end})`;
  return vars;
}

module.exports = { getThemeVars };
