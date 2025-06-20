export const options = {
  chart: {
    height: 350,
    type: 'line',
    zoom: {
      enabled: true,
      type: 'x',
      autoScaleYaxis: true
    },
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true
      },
      autoSelected: 'zoom'
    },
    events: {
      mounted: function(chartContext, config) {
        // Auto-zoom to last 24 hours if data is available
        const xaxis = chartContext.ctx.baseAxes.x;
        if (xaxis) {
          const max = xaxis.max;
          const range = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          chartContext.zoomX(max - range, max);
        }
      }
    }
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    width: [2, 1],
    curve: 'smooth'
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.3,
      stops: [0, 100]
    }
  },
  xaxis: {
    type: 'datetime',
    labels: {
      datetimeUTC: false,
      format: 'MMM dd HH:mm',
      datetimeFormatter: {
        year: 'yyyy',
        month: 'MMM',
        day: 'dd',
        hour: 'HH:mm',
        minute: 'HH:mm'
      },
      style: {
        colors: '#6c757d',
        fontSize: '12px'
      }
    },
    axisBorder: {
      show: true,
      color: '#e9ecef'
    },
    axisTicks: {
      show: true,
      color: '#e9ecef'
    },
    tooltip: {
      enabled: false
    },
    crosshairs: {
      show: true,
      position: 'back',
      stroke: {
        color: '#2e7d32',
        width: 1,
        dashArray: 0
      }
    }
  },
  yaxis: [
    {
      seriesName: 'Price',
      axisTicks: {
        show: true
      },
      axisBorder: {
        show: true,
        color: '#5e72e4'
      },
      labels: {
        style: {
          colors: '#5e72e4'
        },
        formatter: (value) => value.toFixed(6)
      },
      title: {
        text: 'Price',
        style: {
          color: '#5e72e4'
        }
      },
      tooltip: {
        enabled: true
      }
    },
    {
      seriesName: 'Volume',
      opposite: true,
      axisTicks: {
        show: true
      },
      axisBorder: {
        show: true,
        color: '#2dce89'
      },
      labels: {
        style: {
          colors: '#2dce89'
        },
        formatter: (value) => value.toFixed(2)
      },
      title: {
        text: 'Volume',
        style: {
          color: '#2dce89'
        }
      }
    }
  ],
  tooltip: {
    enabled: true,
    shared: true,
    intersect: false,
    x: {
      format: 'dd MMM yyyy HH:mm:ss'
    },
    y: [
      {
        formatter: (value) => `$${value.toFixed(6)}`
      },
      {
        formatter: (value) => `${value.toFixed(2)}`
      }
    ]
  },
  grid: {
    borderColor: '#e9ecef',
    strokeDashArray: 4,
    xaxis: {
      lines: {
        show: true
      }
    },
    yaxis: {
      lines: {
        show: true
      }
    },
    padding: {
      top: 0,
      right: 20,
      bottom: 0,
      left: 10
    }
  },
  colors: ['#2e7d32', '#1b5e20', '#0d4b13', '#0a3a0f', '#06290a', '#031a05'],
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    offsetY: -10,
    itemMargin: {
      horizontal: 10,
      vertical: 5
    },
    markers: {
      radius: 2,
      width: 10,
      height: 10
    }
  },
  noData: {
    text: 'No data available',
    align: 'center',
    verticalAlign: 'middle',
    offsetX: 0,
    offsetY: 0,
    style: {
      color: '#6c757d',
      fontSize: '14px',
      fontFamily: 'inherit'
    }
  },
  markers: {
    size: 4,
    strokeColors: '#fff',
    strokeWidth: 2,
    strokeOpacity: 0.9,
    strokeDashArray: 0,
    fillOpacity: 1,
    discrete: [],
    shape: 'circle',
    radius: 2,
    offsetX: 0,
    offsetY: 0,
    onClick: undefined,
    onDblClick: undefined,
    showNullDataPoints: true,
    hover: {
      size: 6,
      sizeOffset: 2
    }
  },
  responsive: [
    {
      breakpoint: 768,
      options: {
        chart: {
          height: 300
        },
        xaxis: {
          labels: {
            format: 'HH:mm',
            datetimeFormatter: {
              year: 'yy',
              month: 'MMM',
              day: 'dd',
              hour: 'HH:mm',
              minute: 'HH:mm'
            }
          }
        },
        legend: {
          position: 'bottom',
          horizontalAlign: 'center'
        },
        noData: {
          text: 'No data available',
          align: 'center',
          verticalAlign: 'middle',
          offsetX: 0,
          offsetY: 0,
          style: {
            color: '#999',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif'
          }
        }
      }
    }
  ]
};

// Empty series as initial state
export const series = [
  {
    name: 'Price',
    data: []
  }
];
