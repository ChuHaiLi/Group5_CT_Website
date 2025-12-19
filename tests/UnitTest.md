# Unit Testing Guide

## Backend Tests

### Install Dependencies
```bash
cd backend
pip install pytest pytest-cov
```

### Run Tests
```bash
pytest -v --cov=backend --cov-report=term-missing --cov-report=html tests/backend
```

### Coverage Report
- Terminal: Coverage summary with missing lines
- HTML: `htmlcov/index.html`

## Frontend Tests

### Install Dependencies
```bash
cd frontend
npm install
```

### Run Tests
```bash
npx jest --config tests/frontend/jest.config.js --runInBand --coverage
```

# View HTML coverage report
```bash
start .\coverage\lcov-report\index.html
```
### Coverage Report
Coverage summary displayed in terminal.

## Notes

- Run commands from project root directory
- External services (email, OAuth, AI, APIs) are mocked
- Coverage files (`.coverage`, `htmlcov/`, `frontend/coverage/`) are generated locally and should not be committed

