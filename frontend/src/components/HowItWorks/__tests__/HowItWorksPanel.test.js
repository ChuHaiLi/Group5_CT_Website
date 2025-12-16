/**
 * Unit tests for HowItWorksPanel component
 * Tests panel toggle and step interactions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HowItWorksPanel from '../HowItWorksPanel';

// react-router-dom is mocked via __mocks__/react-router-dom.js
const reactRouterDom = require('react-router-dom');
const mockNavigate = reactRouterDom.__mockNavigate;

// Mock chatWidgetEvents - define mock inside factory to avoid hoisting
jest.mock('../../../untils/chatWidgetEvents', () => {
  const mockOpenChatWidget = jest.fn();
  global.__mockOpenChatWidget = mockOpenChatWidget;
  return {
    openChatWidget: mockOpenChatWidget,
  };
});

describe('HowItWorksPanel', () => {
  let mockOpenChatWidget;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenChatWidget = global.__mockOpenChatWidget;
  });

  test('renders toggle button', () => {
    render(
      <MemoryRouter>
        <HowItWorksPanel />
      </MemoryRouter>
    );

    const toggleButton = screen.getByLabelText(/show how it works/i);
    expect(toggleButton).toBeInTheDocument();
  });

  test('opens panel when toggle button is clicked', () => {
    render(
      <MemoryRouter>
        <HowItWorksPanel />
      </MemoryRouter>
    );

    const toggleButton = screen.getByLabelText(/show how it works/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/how wonderai works/i)).toBeInTheDocument();
  });

  test('displays all steps when open', () => {
    render(
      <MemoryRouter>
        <HowItWorksPanel />
      </MemoryRouter>
    );

    const toggleButton = screen.getByLabelText(/show how it works/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/capture your vibe/i)).toBeInTheDocument();
    expect(screen.getByText(/blend ai with real local insight/i)).toBeInTheDocument();
    expect(screen.getByText(/get a smart trip plan/i)).toBeInTheDocument();
    expect(screen.getByText(/save, refine, and perfect/i)).toBeInTheDocument();
  });

  test('opens chat widget when first step is clicked', () => {
    render(
      <MemoryRouter>
        <HowItWorksPanel />
      </MemoryRouter>
    );

    const toggleButton = screen.getByLabelText(/show how it works/i);
    fireEvent.click(toggleButton);

    const firstStep = screen.getByText(/capture your vibe/i);
    fireEvent.click(firstStep);

    expect(mockOpenChatWidget).toHaveBeenCalled();
  });

  test('navigates to explore when second step is clicked', () => {
    render(
      <MemoryRouter>
        <HowItWorksPanel />
      </MemoryRouter>
    );

    const toggleButton = screen.getByLabelText(/show how it works/i);
    fireEvent.click(toggleButton);

    const secondStep = screen.getByText(/blend ai with real local insight/i);
    fireEvent.click(secondStep);

    expect(mockNavigate).toHaveBeenCalledWith('/explore');
  });
});
