import { IsDefined, IsInt, IsDate } from 'class-validator'
import { Creator, Vue } from './'

export class ActiveVue {
  @IsDefined()
  creator!: Creator

  @IsDefined()
  vue!: Vue

  @IsDefined()
  @IsInt()
  creatorId!: number

  @IsDefined()
  @IsInt()
  vueId!: number

  @IsDefined()
  @IsDate()
  assignedAt!: Date
}
