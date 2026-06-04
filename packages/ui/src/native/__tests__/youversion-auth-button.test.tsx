import { render, screen, userEvent } from "@testing-library/react-native";

import { YouVersionAuthButton } from "../youversion-auth-button";

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
let mockIsAuthenticated = false;

jest.mock("@youversion/platform-react-native-expo-core", () => ({
  useYVAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    signIn: mockSignIn,
    signOut: mockSignOut,
  }),
}));

// The SVG logo pulls in react-native-svg; stub it to a plain view.
jest.mock("../bible-app-logo", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return {
    BibleAppLogo: (props: object) => <View testID="bible-app-logo" {...props} />,
  };
});

beforeEach(() => {
  mockSignIn.mockClear();
  mockSignOut.mockClear();
  mockIsAuthenticated = false;
});

describe("YouVersionAuthButton labels", () => {
  it('shows "Sign in with YouVersion" when unauthenticated (mode=auto)', () => {
    render(<YouVersionAuthButton />);
    expect(screen.getByText(/sign in with/i)).toBeTruthy();
  });

  it('shows "Sign in" when unauthenticated and size="short"', () => {
    render(<YouVersionAuthButton size="short" />);
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it('shows "Sign out of YouVersion" when authenticated (mode=auto)', () => {
    mockIsAuthenticated = true;
    render(<YouVersionAuthButton />);
    expect(screen.getByText(/sign out of/i)).toBeTruthy();
  });

  it('shows "Sign Out" when authenticated and size="short"', () => {
    mockIsAuthenticated = true;
    render(<YouVersionAuthButton size="short" />);
    expect(screen.getByText("Sign Out")).toBeTruthy();
  });

  it('shows "Sign out of YouVersion" when mode="signOut" even if unauthenticated', () => {
    render(<YouVersionAuthButton mode="signOut" />);
    expect(screen.getByText(/sign out of/i)).toBeTruthy();
  });

  it('shows "Sign Out" when mode="signOut" and size="short"', () => {
    render(<YouVersionAuthButton mode="signOut" size="short" />);
    expect(screen.getByText("Sign Out")).toBeTruthy();
  });

  it('shows "Sign in with YouVersion" when mode="signIn" and unauthenticated', () => {
    render(<YouVersionAuthButton mode="signIn" />);
    expect(screen.getByText(/sign in with/i)).toBeTruthy();
  });

  it('shows "Sign in with YouVersion" when mode="signIn" even while authenticated', () => {
    mockIsAuthenticated = true;
    render(<YouVersionAuthButton mode="signIn" />);
    expect(screen.getByText(/sign in with/i)).toBeTruthy();
    expect(screen.queryByText(/sign out of/i)).toBeNull();
  });

  it("renders the custom text prop over the default when unauthenticated", () => {
    render(<YouVersionAuthButton text="Continue" />);
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("renders the custom text prop over the default when authenticated", () => {
    mockIsAuthenticated = true;
    render(<YouVersionAuthButton text="Continue" />);
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it('renders no label in size="icon" mode but keeps the logo', () => {
    render(<YouVersionAuthButton size="icon" />);
    expect(screen.queryByText(/sign/i)).toBeNull();
    expect(screen.getByTestId("bible-app-logo")).toBeTruthy();
  });
});

describe("YouVersionAuthButton press behavior", () => {
  it("calls signIn when pressed unauthenticated (mode=auto)", async () => {
    const user = userEvent.setup();
    render(<YouVersionAuthButton />);

    await user.press(screen.getByText(/sign in with/i));

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("calls signOut when pressed authenticated (mode=auto)", async () => {
    mockIsAuthenticated = true;
    const user = userEvent.setup();
    render(<YouVersionAuthButton />);

    await user.press(screen.getByText(/sign out of/i));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('calls signIn when mode="signIn" and unauthenticated', async () => {
    const user = userEvent.setup();
    render(<YouVersionAuthButton mode="signIn" />);

    await user.press(screen.getByText(/sign in with/i));

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signIn when mode="signIn" even while authenticated', async () => {
    mockIsAuthenticated = true;
    const user = userEvent.setup();
    render(<YouVersionAuthButton mode="signIn" />);

    await user.press(screen.getByText(/sign in with/i));

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut when mode="signOut" and unauthenticated', async () => {
    const user = userEvent.setup();
    render(<YouVersionAuthButton mode="signOut" />);

    await user.press(screen.getByText(/sign out of/i));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('calls signOut when mode="signOut" and authenticated', async () => {
    mockIsAuthenticated = true;
    const user = userEvent.setup();
    render(<YouVersionAuthButton mode="signOut" />);

    await user.press(screen.getByText(/sign out of/i));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
