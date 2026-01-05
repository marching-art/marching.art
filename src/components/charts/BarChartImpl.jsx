// src/components/charts/BarChartImpl.jsx
// Lazily loaded Bar chart implementation with Chart.js
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components on first load
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarChartImpl = ({ data, options, ...props }) => {
  return <Bar data={data} options={options} {...props} />;
};

export default BarChartImpl;
