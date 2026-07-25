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
  Legend,
} from 'chart.js';

// Register Chart.js components on first load
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Chart.js data/options are passed straight through; typing them as the
 * library's own generics here would pull chart.js types into every caller for
 * no benefit, so they stay deliberately loose.
 *
 * @param {{data: any, options?: any, [key: string]: any}} props
 */
const BarChartImpl = ({ data, options, ...props }) => {
  return <Bar data={data} options={options} {...props} />;
};

export default BarChartImpl;
