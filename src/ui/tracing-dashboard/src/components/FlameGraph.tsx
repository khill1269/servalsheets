import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { flamegraph } from 'd3-flame-graph';
import { traceToFlameGraph } from '../utils';
import type { RequestTrace } from '../types';
import './FlameGraph.css';
import 'd3-flame-graph/dist/d3-flamegraph.css';

interface FlameGraphProps {
  trace: RequestTrace;
}

export default function FlameGraph({ trace }: FlameGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    d3.select(containerRef.current).selectAll('*').remove();

    // Convert trace to flame graph format
    const data = traceToFlameGraph(trace);

    // Create flame graph
    const chart = flamegraph()
      .width(containerRef.current.clientWidth)
      .cellHeight(18)
      .transitionDuration(750)
      .minFrameSize(5)
      .transitionEase(d3.easeCubic as any) // Type assertion for d3-flame-graph
      .sort(true)
      .title('')
      .tooltip(true);

    // Render
    d3.select(containerRef.current)
      .datum(data)
      .call(chart as any); // Type assertion needed due to d3-flame-graph types

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.width(containerRef.current.clientWidth);
        d3.select(containerRef.current)
          .datum(data)
          .call(chart as any);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [trace]);

  return (
    <div className="flamegraph-container">
      <div className="flamegraph-info">
        <p>
          Click on a frame to zoom in. Click outside to zoom out. Hover to see details.
        </p>
      </div>
      <div ref={containerRef} className="flamegraph" />
    </div>
  );
}
