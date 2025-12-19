import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import AuthRequiredModal from '@/components/AuthRequiredModal/AuthRequired';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('AuthRequiredModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (message) => {
    return render(
      <BrowserRouter>
        <AuthRequiredModal onClose={mockOnClose} message={message} />
      </BrowserRouter>
    );
  };

  test('should render modal title', () => {
    renderComponent();
    
    expect(screen.getByText('Login Required')).toBeInTheDocument();
  });

  test('should render default message when no message prop is provided', () => {
    renderComponent();
    
    expect(screen.getByText(/You need to be logged in to create a trip/)).toBeInTheDocument();
  });

  test('should render custom message when provided', () => {
    const customMessage = 'Please login to save this location';
    renderComponent(customMessage);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  test('should render lock icon', () => {
    const { container } = renderComponent();
    
    const iconDiv = container.querySelector('.auth-modal-icon');
    expect(iconDiv).toBeInTheDocument();
  });

  test('should render Login button', () => {
    renderComponent();
    
    const loginButton = screen.getByRole('button', { name: /Login/i });
    expect(loginButton).toBeInTheDocument();
  });

  test('should render Register button', () => {
    renderComponent();
    
    const registerButton = screen.getByRole('button', { name: /Register/i });
    expect(registerButton).toBeInTheDocument();
  });

  test('should render close button', () => {
    const { container } = renderComponent();

    const closeButton = container.querySelector('.auth-modal-close');
    expect(closeButton).toBeInTheDocument();
  });

  test('should call onClose when close button is clicked', () => {
    const { container } = renderComponent();
    
    const closeButton = container.querySelector('.auth-modal-close');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should call onClose and navigate to login when Login button is clicked', () => {
    renderComponent();
    
    const loginButton = screen.getByRole('button', { name: /Login/i });
    fireEvent.click(loginButton);
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('should call onClose and navigate to register when Register button is clicked', () => {
    renderComponent();
    
    const registerButton = screen.getByRole('button', { name: /Register/i });
    fireEvent.click(registerButton);
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  test('should call onClose when clicking overlay', () => {
    const { container } = renderComponent();
    
    const overlay = container.querySelector('.auth-modal-overlay');
    fireEvent.click(overlay);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should not call onClose when clicking modal content', () => {
    const { container } = renderComponent();
    
    const modalContent = container.querySelector('.auth-modal-content');
    fireEvent.click(modalContent);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('should render footer text', () => {
    renderComponent();
    
    expect(screen.getByText(/Don't have an account?/)).toBeInTheDocument();
  });

  test('should navigate to register when clicking Sign up now link', () => {
    renderComponent();
    
    const signupLink = screen.getByText('Sign up now');
    fireEvent.click(signupLink);
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  test('should have proper modal structure', () => {
    const { container } = renderComponent();
    
    expect(container.querySelector('.auth-modal-overlay')).toBeInTheDocument();
    expect(container.querySelector('.auth-modal-content')).toBeInTheDocument();
    expect(container.querySelector('.auth-modal-actions')).toBeInTheDocument();
  });

  test('should render icons in buttons', () => {
    const { container } = renderComponent();
    
    const loginButton = screen.getByRole('button', { name: /Login/i });
    const registerButton = screen.getByRole('button', { name: /Register/i });
    
    // Check if buttons have icon elements (using SVG check)
    expect(loginButton.querySelector('svg')).toBeInTheDocument();
    expect(registerButton.querySelector('svg')).toBeInTheDocument();
  });

  test('should have different styling for login and register buttons', () => {
    const { container } = renderComponent();
    
    const loginButton = container.querySelector('.login-btn');
    const registerButton = container.querySelector('.register-btn');
    
    expect(loginButton).toBeInTheDocument();
    expect(registerButton).toBeInTheDocument();
  });

  test('should stop propagation when clicking modal content', () => {
    const { container } = renderComponent();
    
    const modalContent = container.querySelector('.auth-modal-content');
    const event = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = jest.spyOn(event, 'stopPropagation');
    
    modalContent.dispatchEvent(event);
    
    expect(stopPropagationSpy).toHaveBeenCalled();
  });
});