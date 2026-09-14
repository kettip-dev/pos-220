import React from 'react'
import ReactApexChart from 'react-apexcharts'
import { useTheme } from '../contexts/ThemeContext'
export default function ReportPaymentTypePieChart({paymentTypes}) {
  const {theme} = useTheme()
  const isDark = theme !== 'light'
  const foreColor = isDark ? '#9CA3AF' : '#6B7280'
  const options = {
    series: paymentTypes.map((v)=>Number(v.total)),
    options: {
      theme: { mode: isDark ? 'dark' : 'light' },
      tooltip: { theme: isDark ? 'dark' : 'light' },
      legend: { labels: { colors: foreColor } },
      chart: {
        width: "100%",
        type: 'pie',
        background: 'transparent',
        foreColor,
      },
       stroke: {
        show: true,
        width: 2,
        colors: theme === 'light' ? '#fff' : '#1f2937'
      },
      colors: theme === 'light' ? ["#D3EE98", "#73EC8B", "#54C392", "#15B392", "#347928", "#A0D683", "#72BF78"] : [ "#5A7A3B", "#256A3F", "#25605B", "#1D4D42", "#284F28", "#4A6B3A", "#3E613F"],
      labels: paymentTypes.map((v)=>v.title),
      responsive: [{
        // breakpoint: 480,
        options: {
          chart: {
            width: "100%"
          },
          legend: {
            position: 'right'
          }
        }
      }]
    },
  }

  return (
    <div>
      <ReactApexChart options={options.options} series={options.series} type="pie" width="100%" />
    </div>
  )
}
