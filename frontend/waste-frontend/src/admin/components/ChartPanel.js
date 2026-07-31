import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const chartMap = { bar: Bar, doughnut: Doughnut, line: Line };
const DEFAULT_DATA = { labels: [], datasets: [] };
const DEFAULT_OPTIONS = { responsive: true, maintainAspectRatio: false };

export default function ChartPanel({ title, subtitle, type = "line", data = DEFAULT_DATA, options = DEFAULT_OPTIONS }) {
  const Chart = chartMap[type] || Line;

  return (
    <section className="eg-card eg-chart-card">
      <div className="eg-card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="eg-chart-body">
        <Chart data={data} options={options} />
      </div>
    </section>
  );
}