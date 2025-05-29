const { Octokit } = require('@octokit/rest');
const config = require('../config');
const logger = require('../utils/logger');

class PermissionValidator {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token
    });
    
    // Cache permissions for 5 minutes to reduce API calls
    this.permissionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    
    // Required permissions for different operations
    this.requiredPermissions = {
      read: ['pull'],
      comment: ['pull'],
      status: ['push'],
      moderate: ['admin', 'maintain']
    };
  }

  async validateRepositoryAccess(repository, operation = 'read') {
    const cacheKey = `${repository.fullName}:${operation}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    try {
      const result = await this.checkRepositoryPermissions(repository, operation);
      
      this.permissionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      logger.error(`Permission validation failed for ${repository.fullName}:`, error);
      return {
        allowed: false,
        error: error.message,
        repository: repository.fullName,
        operation
      };
    }
  }

  async checkRepositoryPermissions(repository, operation) {
    const [owner, repo] = repository.fullName.split('/');
    
    // Check if repository exists and get permissions
    const repoData = await this.getRepositoryInfo(owner, repo);
    
    if (!repoData) {
      return {
        allowed: false,
        reason: 'repository_not_found',
        message: `Repository ${repository.fullName} not found or not accessible`
      };
    }
    
    // Check if repository is private and we have access
    if (repoData.private && !repoData.permissions?.pull) {
      return {
        allowed: false,
        reason: 'private_repository_no_access',
        message: `No access to private repository ${repository.fullName}`
      };
    }
    
    // Check specific operation permissions
    const hasPermission = this.hasRequiredPermission(repoData.permissions, operation);
    
    if (!hasPermission) {
      return {
        allowed: false,
        reason: 'insufficient_permissions',
        message: `Insufficient permissions for ${operation} on ${repository.fullName}`,
        required: this.requiredPermissions[operation],
        actual: repoData.permissions
      };
    }
    
    // Check if repository is archived
    if (repoData.archived && ['comment', 'status'].includes(operation)) {
      return {
        allowed: false,
        reason: 'repository_archived',
        message: `Cannot perform ${operation} on archived repository ${repository.fullName}`
      };
    }
    
    return {
      allowed: true,
      permissions: repoData.permissions,
      repository: {
        name: repoData.name,
        fullName: repoData.full_name,
        private: repoData.private,
        archived: repoData.archived,
        disabled: repoData.disabled
      }
    };
  }

  async getRepositoryInfo(owner, repo) {
    try {
      const response = await this.octokit.repos.get({
        owner,
        repo
      });
      
      return response.data;
    } catch (error) {
      if (error.status === 404) {
        logger.debug(`Repository ${owner}/${repo} not found`);
        return null;
      }
      
      logger.warn(`Failed to get repository info for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  hasRequiredPermission(permissions, operation) {
    if (!permissions) return false;
    
    const required = this.requiredPermissions[operation];
    if (!required) return true; // Unknown operation, allow by default
    
    return required.some(perm => permissions[perm] === true);
  }

  async validateUserPermissions(repository, username, operation = 'read') {
    const cacheKey = `${repository.fullName}:${username}:${operation}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    try {
      const [owner, repo] = repository.fullName.split('/');
      
      const response = await this.octokit.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username
      });
      
      const permission = response.data.permission;
      const hasPermission = this.checkUserPermissionLevel(permission, operation);
      
      const result = {
        allowed: hasPermission,
        username,
        permission,
        repository: repository.fullName,
        operation
      };
      
      if (!hasPermission) {
        result.reason = 'insufficient_user_permissions';
        result.message = `User ${username} has ${permission} permission, but ${operation} requires higher access`;
      }
      
      this.permissionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      if (error.status === 404) {
        return {
          allowed: false,
          reason: 'user_not_collaborator',
          message: `User ${username} is not a collaborator on ${repository.fullName}`,
          username,
          repository: repository.fullName,
          operation
        };
      }
      
      logger.error(`User permission validation failed for ${username} on ${repository.fullName}:`, error);
      throw error;
    }
  }

  checkUserPermissionLevel(permission, operation) {
    const permissionLevels = {
      read: ['read', 'triage', 'write', 'maintain', 'admin'],
      comment: ['triage', 'write', 'maintain', 'admin'],
      status: ['write', 'maintain', 'admin'],
      moderate: ['maintain', 'admin']
    };
    
    const allowedLevels = permissionLevels[operation] || ['read'];
    return allowedLevels.includes(permission);
  }

  async validateBotPermissions(repository) {
    try {
      const result = await this.validateRepositoryAccess(repository, 'comment');
      
      if (!result.allowed) {
        return result;
      }
      
      // Additional checks for bot-specific permissions
      const [owner, repo] = repository.fullName.split('/');
      
      // Check if we can create commit statuses
      try {
        await this.octokit.repos.listCommitStatusesForRef({
          owner,
          repo,
          ref: repository.defaultBranch || 'main'
        });
      } catch (error) {
        if (error.status === 403) {
          logger.warn(`Cannot access commit statuses for ${repository.fullName}`);
        }
      }
      
      return {
        ...result,
        botPermissions: {
          canComment: true,
          canCreateStatus: result.permissions?.push || false,
          canReadContents: result.permissions?.pull || false
        }
      };
    } catch (error) {
      return {
        allowed: false,
        error: error.message,
        repository: repository.fullName
      };
    }
  }

  isPublicRepository(repository) {
    return !repository.private;
  }

  async canAccessRepository(repository) {
    // Quick check for public repositories
    if (this.isPublicRepository(repository)) {
      return { allowed: true, reason: 'public_repository' };
    }
    
    // For private repositories, validate access
    return this.validateRepositoryAccess(repository, 'read');
  }

  async validateWebhookSource(repository, sender) {
    // Validate that the webhook is from a trusted source
    const validation = {
      repository: await this.canAccessRepository(repository),
      sender: null
    };
    
    // Check sender permissions if it's a user action
    if (sender?.login && sender.type === 'User') {
      validation.sender = await this.validateUserPermissions(
        repository, 
        sender.login, 
        'read'
      );
    }
    
    const allowed = validation.repository.allowed && 
      (!validation.sender || validation.sender.allowed);
    
    return {
      allowed,
      validation,
      repository: repository.fullName,
      sender: sender?.login
    };
  }

  clearCache(repository = null) {
    if (repository) {
      // Clear cache for specific repository
      const prefix = `${repository.fullName}:`;
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(prefix)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.permissionCache.clear();
    }
    
    logger.debug('Permission cache cleared', { repository: repository?.fullName });
  }

  getCacheStats() {
    return {
      size: this.permissionCache.size,
      entries: Array.from(this.permissionCache.keys()),
      timeout: this.cacheTimeout
    };
  }
}

module.exports = PermissionValidator;