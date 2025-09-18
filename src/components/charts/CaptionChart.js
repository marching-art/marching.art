import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const getThemeColors = () => {
    if (typeof window === 'undefined') {
        return {
            primary: 'rgba(59, 130, 246, 0.7)',
            secondary: 'rgba(55, 65, 81, 0.7)',
            accent: 'rgba(229, 231, 235, 0.7)',
            textPrimary: '#111827',
            textSecondary: '#6B7280',
            grid: 'rgba(229, 231, 235, 0.5)',
        };
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const isDarkMode = document.documentElement.classList.contains('dark');
    const getColor = (varName) => `rgb(${rootStyles.getPropertyValue(varName).trim()})`;

    return {
        primary: isDarkMode ? getColor('--color-primary-dark') : getColor('--color-primary'),
        secondary: isDarkMode ? getColor('--color-secondary-dark') : getColor('--color-secondary'),
        accent: isDarkMode ? getColor('--color-accent-dark') : getColor('--color-accent'),
        textPrimary: isDarkMode ? getColor('--text-primary-dark') : getColor('--text-primary'),
        textSecondary: isDarkMode ? getColor('--text-secondary-dark') : getColor('--text-secondary'),
        grid: `${isDarkMode ? getColor('--color-accent-dark') : getColor('--color-accent')} / 0.2`,
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
                backgroundColor: `${themeColors.primary}B3`, // B3 is ~70% opacity in hex
                borderColor: themeColors.primary,
                borderWidth: 1,
            },
            {
                label: 'Visual Score',
                data: topCorps.map(c => c.visualScore),
                backgroundColor: `${themeColors.secondary}B3`,
                borderColor: themeColors.secondary,
                borderWidth: 1,
            },
            {
                label: 'Music Score',
                data: topCorps.map(c => c.musicScore),
                backgroundColor: `${themeColors.accent}B3`,
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