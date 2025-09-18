import toast from 'react-hot-toast';

export const showSuccessToast = (message) => {
    toast.success(message, {
        style: {
            background: '#333',
            color: '#fff',
        },
    });
};

export const showErrorToast = (message) => {
    toast.error(message, {
        style: {
            background: '#333',
            color: '#fff',
        },
    });
};