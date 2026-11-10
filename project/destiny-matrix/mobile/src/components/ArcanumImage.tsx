import { Image, View } from 'react-native';
import { useApp } from '../state/AppState';

import { deck } from '../native/deck';

const waiteDeck = [
  null,
  require('../../../web/public/img/arcana/waite/1.webp'),
  require('../../../web/public/img/arcana/waite/2.webp'),
  require('../../../web/public/img/arcana/waite/3.webp'),
  require('../../../web/public/img/arcana/waite/4.webp'),
  require('../../../web/public/img/arcana/waite/5.webp'),
  require('../../../web/public/img/arcana/waite/6.webp'),
  require('../../../web/public/img/arcana/waite/7.webp'),
  require('../../../web/public/img/arcana/waite/8.webp'),
  require('../../../web/public/img/arcana/waite/9.webp'),
  require('../../../web/public/img/arcana/waite/10.webp'),
  require('../../../web/public/img/arcana/waite/11.webp'),
  require('../../../web/public/img/arcana/waite/12.webp'),
  require('../../../web/public/img/arcana/waite/13.webp'),
  require('../../../web/public/img/arcana/waite/14.webp'),
  require('../../../web/public/img/arcana/waite/15.webp'),
  require('../../../web/public/img/arcana/waite/16.webp'),
  require('../../../web/public/img/arcana/waite/17.webp'),
  require('../../../web/public/img/arcana/waite/18.webp'),
  require('../../../web/public/img/arcana/waite/19.webp'),
  require('../../../web/public/img/arcana/waite/20.webp'),
  require('../../../web/public/img/arcana/waite/21.webp'),
  require('../../../web/public/img/arcana/waite/22.webp'),
];

export function ArcanumImage({ n, width = 112, decorative = false, waite = false, onLoad }: {
  n: number; width?: number; decorative?: boolean; waite?: boolean; onLoad?: () => void;
}) {
  const { t } = useApp();
  if (!Number.isInteger(n) || n < 1 || n > 22) return null;
  const source = (waite ? waiteDeck : deck)[n];
  const asset = Image.resolveAssetSource(source);
  const height = waite ? width * (asset?.height ?? 780) / (asset?.width ?? 520) : width * 700 / 520;
  // Match .arccard on the website: hide the generated caption at the bottom, keep the entire top.
  return <View testID={`arcanum-image-${n}${waite ? '-waite' : ''}`} style={{ width, height, overflow: 'hidden', borderRadius: 7, backgroundColor: '#faf7f0', borderWidth: 1, borderColor: '#d8c9a4' }}>
    <Image testID={`arcanum-art-${n}`} onLoad={onLoad} source={source} resizeMode="stretch" accessible={!decorative}
      accessibilityLabel={decorative ? undefined : t(`Карта аркана ${n}`, `Arcanum ${n} card`)}
      style={{ width, height: waite ? height : width * 780 / 520 }} />
  </View>;
}
