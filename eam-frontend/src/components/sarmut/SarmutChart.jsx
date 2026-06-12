import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function SarmutChart({ labels, targetData, actualData, maxVal }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Initialize chart
    const chart = echarts.init(chartRef.current);
    
    const option = {
      animation: false,
      grid: {
        top: 30,
        right: 10,
        bottom: 20,
        left: 30,
        containLabel: true
      },
      legend: {
        data: ['Target (%)', 'Aktual (%)'],
        top: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 10 }
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxVal,
        interval: 20,
        axisLabel: {
          formatter: '{value}%',
          color: '#64748b',
          fontSize: 10
        },
        splitLine: {
          lineStyle: { type: 'dashed', color: '#e2e8f0' }
        }
      },
      series: [
        {
          name: 'Target (%)',
          type: 'bar',
          data: targetData,
          itemStyle: { color: '#30528A' },
          barGap: '0%',
          barCategoryGap: '40%'
        },
        {
          name: 'Aktual (%)',
          type: 'bar',
          data: actualData,
          itemStyle: { color: '#EC363A' }
        }
      ]
    };

    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [labels, targetData, actualData, maxVal]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}
