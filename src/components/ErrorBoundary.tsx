import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            fontFamily: 'var(--font-ui, sans-serif)',
            color: 'var(--brown-800, #44403c)',
            background: 'var(--beige-50, #fbf8f4)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-display, serif)', fontWeight: 400 }}>
            Something went wrong
          </h1>
          <p>The canvas hit an unexpected error. Your saved networks are safe.</p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: 8,
              border: '1px solid var(--beige-300, #d8cfc3)',
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
