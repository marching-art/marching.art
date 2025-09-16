import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const getThemeColors = () => {
    if (typeof window === 'undefined') {
        return {
            primary: 'rgba(59, 130, 246, 0.7)',
            secondary: 'rgba(251, 191, 36, 0.7)',
            accent: 'rgba(156, 163, 175, 0.7)',
            textPrimary: '#1F2937',
            textSecondary: '#4B5563',
            grid: 'rgba(209, 213, 219, 0.5)',
        };
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const getColor = (name) => `rgb(${rootStyles.getPropertyValue(name).trim()})`;

    return {
        primary: `${getColor('--color-primary')}`,
        secondary: `${getColor('--color-secondary')}`,
        accent: `${getColor('--color-accent')}`,
        textPrimary: `${getColor('--text-primary')}`,
        textSecondary: `${getColor('--text-secondary')}`,
        grid: `${getColor('--color-accent')} / 0.2`,
    };
};


const CaptionChart = ({ showData, theme }) => {
    const [themeColors, setThemeColors] = useState(getThemeColors());

    useEffect(() => {
        setThemeColors(getThemeColors());
    }, [theme]);

    if (!showData || !showData.results || showData.results.length === 0) {
        return null;
    }

    const topCorps = showData.results.slice(0, 5);

    const data = {
        labels: topCorps.map(c => c.corpsName),
        datasets: [
            {
                label: 'GE Score',
                data: topCorps.map(c => c.geScore),
                backgroundColor: `${themeColors.primary} / 0.7`,
                borderColor: themeColors.primary,
                borderWidth: 1,
            },
            {
                label: 'Visual Score',
                data: topCorps.map(c => c.visualScore),
                backgroundColor: `${themeColors.secondary} / 0.7`,
                borderColor: themeColors.secondary,
                borderWidth: 1,
            },
            {
                label: 'Music Score',
                data: topCorps.map(c => c.musicScore),
                backgroundColor: `${themeColors.accent} / 0.7`,
                borderColor: themeColors.accent,
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
                    color: themeColors.textPrimary,
                }
            },
            title: {
                display: true,
                text: `Caption Breakdown for ${showData.eventName.replace(/DCI/g, 'marching.art')}`,
                color: themeColors.textPrimary,
                font: {
                    size: 18,
                }
            },
        },
        scales: {
            x: {
                ticks: {
                    color: themeColors.textSecondary,
                },
                grid: {
                    color: themeColors.grid,
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: themeColors.textSecondary,
                },
                 grid: {
                    color: themeColors.grid,
                }
            },
        },
    };

    return <Bar options={options} data={data} />;
};

export default CaptionChart;