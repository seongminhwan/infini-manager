# 数据库迁移修复说明

本文档说明了对数据库迁移问题的修复，解决了部分用户环境中无法正常运行业务功能的问题。

## 问题分析

通过检查数据库记录和迁移文件，发现以下问题：

1. **迁移文件不一致**：
   - 数据库中记录了多个在代码库中不存在的迁移文件
   - 关键缺失文件有：
     - 20250526_add_random_user_country_config.ts（原为20250525，修正序号解决冲突）
     - 20250534_create_infini_batch_transfers.ts
     - 20250535_create_infini_batch_transfer_relations.ts
     - 20250536_add_target_fields_to_batch_transfers.ts
     - 20250537_add_target_fields_to_infini_batch_transfers.ts
     - 20250538_extend_infini_batch_transfer_relations.ts
     - 20250540_modify_transfer_id_in_batch_transfer_relations.ts
     - 20250541_add_batch_id_to_infini_batch_transfer_relations_history.ts

2. **迁移文件重命名**：
   - 批量转账相关迁移文件从20250534前缀被重命名为20250546前缀
   - 导致新用户环境中缺少这些表结构

3. **迁移序号冲突**：
   - 20250525_create_user_configs.ts 和 20250525_add_random_user_country_config.ts 使用相同序号
   - 导致依赖user_configs表的迁移可能在表创建前执行，引发错误

4. **混合的数据库初始化方式**：
   - 部分表通过标准Knex迁移创建
   - 代理池相关表通过独立SQL脚本(create_proxy_tables.sql)创建
   - 部分表通过直接JS脚本(create-history-table.js)创建

5. **宽松的错误处理**：
   - 使用`disableMigrationsListValidation: true`跳过迁移文件验证
   - 当迁移文件缺失时只记录警告，不终止应用

## 修复内容

1. **添加所有缺失迁移文件**：
   - 创建了所有缺失的迁移文件，包括：
     - 20250526_add_random_user_country_config.ts（调整序号避免冲突）
     - 20250534_create_infini_batch_transfers.ts
     - 20250535_create_infini_batch_transfer_relations.ts
     - 20250536_add_target_fields_to_batch_transfers.ts
     - 20250537_add_target_fields_to_infini_batch_transfers.ts
     - 20250538_extend_infini_batch_transfer_relations.ts
     - 20250540_modify_transfer_id_in_batch_transfer_relations.ts
     - 20250541_add_batch_id_to_infini_batch_transfer_relations_history.ts

2. **解决迁移序号冲突**：
   - 将依赖user_configs表的迁移文件改为更高序号，确保正确的执行顺序
   - 将20250525_add_random_user_country_config.ts重命名为20250526_add_random_user_country_config.ts
   
3. **增强数据库安全保护**：
   - **自动备份机制**：
     - 在数据库初始化和迁移执行前自动创建备份
     - 备份路径保存在环境变量中，方便数据恢复
     - 支持通过环境变量控制备份策略
   
   - **危险迁移检测**：
     - 自动扫描迁移文件，检测DELETE、DROP TABLE等危险操作
     - 对检测到的危险操作提供详细警告
     - 需要通过环境变量显式确认才能执行危险迁移
   
   - **迁移文件完整性验证**：
     - 验证所有已记录的迁移文件是否存在
     - 发现缺失文件时立即终止迁移，并提供详细错误信息
   
   - **独立事务执行**：
     - 每个迁移在独立事务中执行，避免一个失败导致全部回滚
     - 减少长事务带来的锁表风险

4. **改进数据库初始化逻辑**：
   - 修改db.ts中的错误处理，提供清晰的迁移问题解决指南
   - 当检测到迁移问题时，显示明确的错误信息和解决步骤
   - 强制验证迁移文件列表，不再使用disableMigrationsListValidation配置
## 解决方案

如果你遇到数据库迁移问题，可以选择以下解决方案：

### 方案一：重置数据库（推荐新用户）

删除现有数据库文件，让系统重新创建所有表结构：

**SQLite**:
```bash
# 删除SQLite数据库文件
rm backend/db/infini.sqlite3
# 重启应用，系统会自动创建新的数据库
```

**MySQL**:
```bash
# 运行重置脚本
mysql -u your_username -p < backend/reset-mysql.sql
```

### 方案二：手动修复（适用于有数据的生产环境）

1. 确保所有迁移文件都存在
2. 如果仍有问题，可以尝试以下步骤：
   ```bash
   # 查看knex_migrations表内容
   sqlite3 backend/db/infini.sqlite3 "SELECT * FROM knex_migrations ORDER BY id;"
   
   # 如果存在序号冲突记录，修改名称
   sqlite3 backend/db/infini.sqlite3 "UPDATE knex_migrations SET name = '20250526_add_random_user_country_config.ts' WHERE name = '20250525_add_random_user_country_config.ts';"
   ```

### 方案三：安全执行危险迁移

如果系统检测到危险迁移操作，您可以选择：

1. **确认执行**：在确认了解风险后，使用环境变量确认执行
   ```bash
   # 设置环境变量允许执行危险迁移
   CONFIRM_DANGEROUS_MIGRATIONS=true npm run dev
   ```

2. **跳过备份检查**：在特殊情况下，可以跳过备份失败检查
   ```bash
   # 设置环境变量允许在备份失败时继续执行迁移
   ALLOW_MIGRATION_WITHOUT_BACKUP=true npm run dev
   ```

⚠️ **警告**：这些选项应谨慎使用，特别是在生产环境中

## 避免未来类似问题的建议

1. **迁移文件管理**：
   - 不要重命名或删除已执行的迁移文件
   - 如需修改表结构，创建新的迁移文件而不是修改现有文件
   - 确保每个迁移文件使用唯一序号，考虑表之间的依赖关系

2. **安全的数据修改**：
   - 避免在迁移中使用DELETE操作，优先使用软删除
   - 修改表结构时，先添加新字段，再迁移数据，最后删除旧字段
   - 添加非空约束前先填充NULL值
   - 大型数据迁移考虑分批处理，避免长时间锁表

3. **数据保护**：
   - 定期备份数据库
   - 重要操作前手动创建备份
   - 使用事务包装数据修改操作
   - 为生产环境添加自动备份策略

4. **完善文档与测试**：
   - 详细说明数据库迁移流程
   - 在测试环境验证迁移脚本
   - 验证迁移后的数据完整性
   - 编写测试确保业务功能正常工作

## 测试和验证

修复后，可以通过以下方式验证：

1. 删除数据库文件，重新启动应用
2. 确认所有表结构正确创建
3. 测试批量转账等业务功能是否正常运行

如果您仍然遇到问题，请联系技术支持。