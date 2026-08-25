import { User, IUser } from "../models/User";
import { generateToken, JWTPayload } from "../config/jwt";

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role?: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER";
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<IUser, "password">;
  token: string;
}

export class UserService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Validate passwords match
    if (input.password !== input.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Create new user
    const user = new User({
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role || "PROCUREMENT_OFFICER",
    });

    await user.save();

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      user: user.toJSON() as unknown as Omit<IUser, "password">,
      token,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user with password field
    const user = await User.findOne({ email: input.email }).select("+password");

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error("User account is inactive");
    }

    // Generate token with appropriate context
    const tokenPayload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    if (user.organizationId) {
      tokenPayload.organizationId = user.organizationId.toString();
    }

    if (user.vendorId) {
      tokenPayload.vendorId = user.vendorId.toString();
    }

    const token = generateToken(tokenPayload);

    return {
      user: user.toJSON() as unknown as Omit<IUser, "password">,
      token,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    return await User.findById(userId);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<IUser>): Promise<IUser | null> {
    // Don't allow password update through this method
    if (updates.password) {
      delete updates.password;
    }

    return await User.findByIdAndUpdate(userId, updates, { new: true });
  }

  /**
   * Get all active users
   */
  async getAllUsers(role?: string): Promise<IUser[]> {
    const query = { isActive: true };
    if (role) {
      (query as any).role = role;
    }
    return await User.find(query);
  }
}

export const userService = new UserService();
