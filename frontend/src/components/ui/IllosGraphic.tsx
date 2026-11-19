import React, { useEffect, useRef } from 'react';

import heroSvg from '../../assets/illos/hero.svg?raw';
import warehouseSvg from '../../assets/illos/warehouse.svg?raw';
import seatsSvg from '../../assets/illos/seats.svg?raw';
import snapshotSvg from '../../assets/illos/snapshot.svg?raw';
import foundationSvg from '../../assets/illos/foundation.svg?raw';
import governanceSvg from '../../assets/illos/governance.svg?raw';
import fieldserviceSvg from '../../assets/illos/fieldservice.svg?raw';
import supportSvg from '../../assets/illos/support.svg?raw';
import logisticsSvg from '../../assets/illos/logistics.svg?raw';

export type IllosName =
  | 'hero'
  | 'warehouse'
  | 'seats'
  | 'snapshot'
  | 'foundation'
  | 'governance'
  | 'fieldservice'
  | 'support'
  | 'logistics';

const svgMap: Record<IllosName, string> = {
  hero: heroSvg,
  warehouse: warehouseSvg,
  seats: seatsSvg,
  snapshot: snapshotSvg,
  foundation: foundationSvg,
  governance: governanceSvg,
  fieldservice: fieldserviceSvg,
  support: supportSvg,
  logistics: logisticsSvg,
};

interface IllosGraphicProps {
  name: IllosName;
  className?: string;
  style?: React.CSSProperties;
}

export const IllosGraphic: React.FC<IllosGraphicProps> = ({ name, className = '', style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawSvg = svgMap[name] || '';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    el.style.setProperty('--illos-play', 'paused');

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        el.style.setProperty('--illos-play', entry.isIntersecting ? 'running' : 'paused');
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-illos
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: rawSvg }}
    />
  );
};

export default IllosGraphic;
