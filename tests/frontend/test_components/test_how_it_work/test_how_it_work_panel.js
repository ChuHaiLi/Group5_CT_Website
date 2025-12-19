import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import HowItWorksPanel from '@/components/HowItWorks/HowItWorksPanel';
import { openChatWidget } from '@/untils/chatWidgetEvents';

// Mock navigation and chat widget events
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('../../../../frontend/src/untils/chatWidgetEvents', () => ({
  openChatWidget: jest.fn()
}));

describe('HowItWorksPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <HowItWorksPanel />
      </BrowserRouter>
    );
  };

  test('should render toggle button', () => {
    renderComponent();
    
    const toggleButton = screen.getByLabelText('Show how it works');
    expect(toggleButton).toBeInTheDocument();
  });

  test('should be closed by default', () => {
    const { container } = renderComponent();
    
    const shell = container.querySelector('.howitworks-shell');
    expect(shell).not.toHaveClass('open');
  });

  test('should open panel when toggle button is clicked', () => {
    const { container } = renderComponent();
    
    const toggleButton = screen.getByLabelText('Show how it works');
    fireEvent.click(toggleButton);
    
    const shell = container.querySelector('.howitworks-shell');
    expect(shell).toHaveClass('open');
  });

  test('should close panel when toggle button is clicked again', () => {
    const { container } = renderComponent();
    
    const toggleButton = screen.getByLabelText('Show how it works');
    
    // Open
    fireEvent.click(toggleButton);
    expect(container.querySelector('.howitworks-shell')).toHaveClass('open');
    
    // Close
    const closeButton = screen.getByLabelText('Hide how it works');
    fireEvent.click(closeButton);
    expect(container.querySelector('.howitworks-shell')).not.toHaveClass('open');
  });

  test('should render panel title', () => {
    renderComponent();
    
    expect(screen.getByText('🌟 How WonderAI Works')).toBeInTheDocument();
  });

  test('should render all 4 steps', () => {
    renderComponent();
    
    expect(screen.getByText('1. Capture your vibe')).toBeInTheDocument();
    expect(screen.getByText('2. Blend AI with real local insight')).toBeInTheDocument();
    expect(screen.getByText('3. Get a smart trip plan')).toBeInTheDocument();
    expect(screen.getByText('4. Save, refine, and perfect')).toBeInTheDocument();
  });

  test('should render step descriptions', () => {
    renderComponent();
    
    expect(screen.getByText(/Tell us what you dream of/)).toBeInTheDocument();
    expect(screen.getByText(/Our engine pairs OpenAI intelligence/)).toBeInTheDocument();
    expect(screen.getByText(/Receive personalized ideas/)).toBeInTheDocument();
    expect(screen.getByText(/Add suggestions to your trip/)).toBeInTheDocument();
  });

  test('should open chat widget when clicking first step', () => {
    renderComponent();
    
    const firstStep = screen.getByText('1. Capture your vibe');
    fireEvent.click(firstStep);
    
    expect(openChatWidget).toHaveBeenCalled();
  });

  test('should navigate to explore when clicking second step', () => {
    renderComponent();
    
    const secondStep = screen.getByText('2. Blend AI with real local insight');
    fireEvent.click(secondStep);
    
    expect(mockNavigate).toHaveBeenCalledWith('/explore');
  });

  test('should navigate to MyTrips when clicking third step', () => {
    renderComponent();
    
    const thirdStep = screen.getByText('3. Get a smart trip plan');
    fireEvent.click(thirdStep);
    
    expect(mockNavigate).toHaveBeenCalledWith('/MyTrips');
  });

  test('should navigate to Saved when clicking fourth step', () => {
    renderComponent();
    
    const fourthStep = screen.getByText('4. Save, refine, and perfect');
    fireEvent.click(fourthStep);
    
    expect(mockNavigate).toHaveBeenCalledWith('/Saved');
  });

  test('should show preview image on hover', () => {
    const { container } = renderComponent();
    
    const firstStep = screen.getByText('1. Capture your vibe');
    fireEvent.mouseEnter(firstStep);
    
    const preview = container.querySelector('.howitworks-preview');
    expect(preview).toBeInTheDocument();
  });

  test('should hide preview image on mouse leave', () => {
    const { container } = renderComponent();
    
    const firstStep = screen.getByText('1. Capture your vibe');
    
    // Show preview
    fireEvent.mouseEnter(firstStep);
    expect(container.querySelector('.howitworks-preview')).toBeInTheDocument();
    
    // Hide preview
    fireEvent.mouseLeave(firstStep);
    expect(container.querySelector('.howitworks-preview')).not.toBeInTheDocument();
  });

  test('should render step icons as data attributes', () => {
    const { container } = renderComponent();
    
    const steps = container.querySelectorAll('.howitworks-step-item');
    expect(steps[0]).toHaveAttribute('data-icon', '⚡');
    expect(steps[1]).toHaveAttribute('data-icon', '🧭');
    expect(steps[2]).toHaveAttribute('data-icon', '✨');
    expect(steps[3]).toHaveAttribute('data-icon', '❤️');
  });

  test('should have proper ARIA attributes', () => {
    const { container } = renderComponent();

    const panel = container.querySelector('.howitworks-panel');
    expect(panel).toHaveAttribute('aria-hidden', 'true');

    const toggleButton = screen.getByLabelText('Show how it works');
    fireEvent.click(toggleButton);

    expect(panel).toHaveAttribute('aria-hidden', 'false');
  });
});