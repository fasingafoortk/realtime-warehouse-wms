import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../users/user.model';
import { ConflictError, UnauthorizedError } from '../../errors/custom-errors';

export interface ILoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private accessSecret = process.env.JWT_SECRET || 'super-secret-access-token-key-change-in-production';
  private refreshSecret = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-change-in-production';
  private accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
  private refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

  public async register(data: {
    email: string;
    passwordHash: string; // Will hash it here
    name: string;
    role: 'Admin' | 'Warehouse Manager' | 'Picker' | 'Auditor';
  }): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ConflictError(`User with email '${data.email}' already exists.`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.passwordHash, salt);

    const user = new User({
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
    });

    return await user.save();
  }

  public async login(email: string, passwordHash: string): Promise<ILoginResponse> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials.');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  public async refresh(token: string): Promise<ILoginResponse> {
    try {
      const decoded = jwt.verify(token, this.refreshSecret) as { id: string };
      const user = await User.findById(decoded.id);

      if (!user || user.refreshToken !== token) {
        throw new UnauthorizedError('Invalid refresh token.');
      }

      const accessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      user.refreshToken = newRefreshToken;
      await user.save();

      return {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (err) {
      throw new UnauthorizedError('Refresh token expired or invalid.');
    }
  }

  public async logout(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
  }

  private generateAccessToken(user: IUser): string {
    return jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      this.accessSecret,
      { expiresIn: this.accessExpiry as any }
    );
  }

  private generateRefreshToken(user: IUser): string {
    return jwt.sign({ id: user._id.toString() }, this.refreshSecret, {
      expiresIn: this.refreshExpiry as any,
    });
  }
}
export default AuthService;
