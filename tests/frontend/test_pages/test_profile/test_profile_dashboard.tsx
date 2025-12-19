import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileDashboardPage } from '../ProfileDashboardPage';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock child components
jest.mock('../../components/Profile/SidebarNavigation', () => ({
  SidebarNavigation: ({ active }: any) => (
    <div data-testid="sidebar-navigation" data-active={active}>
      Sidebar
    </div>
  ),
}));

jest.mock('../../components/Profile/StatsCard', () => ({
  StatsCard: ({ title, value, helperText }: any) => (
    <div data-testid="stats-card">
      <h3>{title}</h3>
      <p>{value}</p>
      <span>{helperText}</span>
    </div>
  ),
}));

describe('ProfileDashboardPage', () => {
  test('should render page title', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('should render page description', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Get a snapshot of how your travel plans are tracking.')).toBeInTheDocument();
  });

  test('should render sidebar navigation with dashboard active', () => {
    render(<ProfileDashboardPage />);
    
    const sidebar = screen.getByTestId('sidebar-navigation');
    expect(sidebar).toHaveAttribute('data-active', 'dashboard');
  });

  test('should render all three stats cards', () => {
    render(<ProfileDashboardPage />);
    
    const statsCards = screen.getAllByTestId('stats-card');
    expect(statsCards).toHaveLength(3);
  });

  test('should render Total Trips stat', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Total Trips')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Trips planned this year')).toBeInTheDocument();
  });

  test('should render Trips Saved stat', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Trips Saved')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Ideas waiting on your list')).toBeInTheDocument();
  });

  test('should render Trips Completed stat', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Trips Completed')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Journeys already taken')).toBeInTheDocument();
  });

  test('should render chart section title', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Trips Over Time')).toBeInTheDocument();
  });

  test('should render chart section description', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Track weekly, monthly, and yearly travel momentum.')).toBeInTheDocument();
  });

  test('should render update badge', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByText('Updated weekly')).toBeInTheDocument();
  });

  test('should render chart components', () => {
    render(<ProfileDashboardPage />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  test('should have proper page layout structure', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveClass('flex-1');
  });

  test('should have proper background color', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const pageContainer = container.firstChild;
    expect(pageContainer).toHaveClass('min-h-screen', 'bg-[#F4F6FB]');
  });

  test('should render stats in grid layout', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const statsSection = container.querySelector('section.grid');
    expect(statsSection).toBeInTheDocument();
  });

  test('should render chart in proper container', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const chartSection = container.querySelector('section.rounded-3xl');
    expect(chartSection).toBeInTheDocument();
  });

  test('should have responsive flex layout', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const flexContainer = container.querySelector('.flex.flex-col.md\\:flex-row');
    expect(flexContainer).toBeInTheDocument();
  });

  test('should render page heading with correct size', () => {
    render(<ProfileDashboardPage />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Dashboard');
    expect(heading).toHaveClass('text-3xl', 'font-semibold');
  });

  test('should render chart section with shadow', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const chartSection = container.querySelector('.shadow-xl');
    expect(chartSection).toBeInTheDocument();
  });

  test('should have proper spacing between sections', () => {
    const { container } = render(<ProfileDashboardPage />);
    
    const sections = container.querySelectorAll('section');
    sections.forEach(section => {
      expect(section).toHaveClass(expect.stringContaining('mt-'));
    });
  });
});