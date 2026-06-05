import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Reusable Chart Component using native Chart.js.
 * Automatically handles canvas cleanup to prevent memory leaks and chart redraw bugs.
 */
export default function ChartComponent({ data, type = 'bar', options = {} }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    // Destroy existing chart if any
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      chartInstanceRef.current = new Chart(ctx, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#9ca3af', // Match text muted colors
                font: {
                  family: "'Inter', sans-serif"
                }
              }
            }
          },
          scales: {
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.05)'
              },
              ticks: {
                color: '#9ca3af'
              }
            },
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.05)'
              },
              ticks: {
                color: '#9ca3af'
              }
            }
          },
          ...options
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, type, options]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
