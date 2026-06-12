import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center border-2 border-dashed border-red-200 rounded-2xl bg-red-50 m-4">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-red-700 mb-2">Komponen Rusak (Crash)</h2>
          <p className="text-sm text-red-600 font-medium mb-6">Sebagian fitur ini gagal dimuat. Sistem utama masih berjalan normal.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2.5 bg-white text-red-600 font-bold rounded-xl shadow-sm border border-red-200 hover:bg-red-50 transition-colors"
          >
            Muat Ulang Komponen
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
