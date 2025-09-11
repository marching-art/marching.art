import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CaptionChart = ({ showData, theme }) => {
    if (!showData || !showData.results || showData.results.length === 0) {
        return null;
    }

    // Take the top 5 corps for clarity, or all if fewer than 5
    const topCorps = showData.results.slice(0, 5);

    const data = {
        labels: topCorps.map(c => c.corpsName),
        datasets: [
            {
                label: 'GE Score',
                data: topCorps.map(c => c.geScore),
                backgroundColor: 'rgba(59, 130, 246, 0.7)', // brand-primary
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
            },
            {
                label: 'Visual Score',
                data: topCorps.map(c => c.visualScore),
                backgroundColor: 'rgba(251, 191, 36, 0.7)', // brand-secondary
                borderColor: 'rgba(251, 191, 36, 1)',
                borderWidth: 1,
            },
            {
                label: 'Music Score',
                data: topCorps.map(c => c.musicScore),
                backgroundColor: 'rgba(156, 163, 175, 0.7)', // brand-accent
                borderColor: 'rgba(156, 163, 175, 1)',
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
                }
            },
            title: {
                display: true,
                text: `Caption Breakdown for ${showData.eventName}`,
                color: theme === 'dark' ? '#F9FAFB' : '#1F2937',
                font: {
                    size: 18,
                }
            },
        },
        scales: {
            x: {
                ticks: {
                    color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                },
                grid: {
                    color: theme === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(209, 213, 219, 0.5)',
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: theme === 'dark' ? '#D1D5DB' : '#4B5563',
                },
                 grid: {
                    color: theme === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(209, 213, 219, 0.5)',
                }
            },
        },
    };

    return <Bar options={options} data={data} />;
};

export default CaptionChart;
