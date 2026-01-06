// src/components/charts/LineChartImpl.jsx
// Lazily loaded Line chart implementation with Chart.js
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components on first load
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LineChartImpl = ({ data, options, ...props }) => {
  return <Line data={data} options={options} {...props} />;
};

export default LineChartImpl;
