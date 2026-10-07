import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import * as api from '@/api/endpoints';
import { useAuth } from '@/state/auth';

import SignInScreen from '@/app/sign-in';

jest.mock('@/db/database', () => ({ clearLocalData: jest.fn(), cacheGet: jest.fn(), cacheSet: jest.fn() }));
jest.mock('@/api/endpoints');

const metrics = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SignInScreen />
    </SafeAreaProvider>,
  );
}

async function fill(server: string) {
  await fireEvent.changeText(screen.getByLabelText('Server address'), server);
  await fireEvent.changeText(screen.getByLabelText('Email or username'), 'njoro@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Sign in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.setState({ status: 'signedOut', credentials: null, lastServer: null });
  });

  it('defaults the server field to https://', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Server address').props.value).toBe('https://');
  });

  it("shows the server's message for a user without the role", async () => {
    jest.mocked(api.signIn).mockRejectedValueOnce(new ApiError("This account isn't set up for Lift Log yet.", 403));
    await renderScreen();
    await fill('https://dashboard.erpkenya.com');
    expect(await screen.findByText("This account isn't set up for Lift Log yet.")).toBeTruthy();
  });

  it('refuses plain http', async () => {
    await renderScreen();
    await fill('http://dashboard.erpkenya.com');
    expect(await screen.findByText('Enter the full server address, starting with https://')).toBeTruthy();
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it('signs in and stores the token', async () => {
    jest.mocked(api.signIn).mockResolvedValueOnce({
      api_key: 'k',
      api_secret: 's',
      user: 'njoro@example.com',
      full_name: 'Njoro',
      has_profile: false,
    });
    await renderScreen();
    await fill('https://dashboard.erpkenya.com/');
    await waitFor(() =>
      expect(useAuth.getState()).toMatchObject({
        status: 'signedIn',
        hasProfile: false,
        credentials: { server: 'https://dashboard.erpkenya.com', apiKey: 'k', apiSecret: 's' },
      }),
    );
    expect(api.signIn).toHaveBeenCalledWith('https://dashboard.erpkenya.com', 'njoro@example.com', 'secret');
  });
});
